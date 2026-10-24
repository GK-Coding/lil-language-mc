type SpeechResult = { isFinal: boolean; length: number; [index: number]: { transcript: string; confidence: number } };
type ResultEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(track?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };

export type SpeechCallbacks = {
  transcript: (id: string, text: string, final: boolean) => void;
  state: (state: 'starting' | 'listening' | 'processing' | 'stopped') => void;
  error: (message: string) => void;
  ended: () => void;
};

function recognitionConstructor() {
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

export function speechCapabilities() {
  const chrome = navigator.userAgent.match(/(?:Chrome|Edg)\/(\d+)/);
  const desktop = !/Android|iPhone|iPad|Mobile/.test(navigator.userAgent);
  return {
    microphone: Boolean(recognitionConstructor()),
    // MDN compatibility data: audioTrack input starts in desktop Chromium 135.
    audioTrack: Boolean(recognitionConstructor() && desktop && chrome && Number(chrome[1]) >= 135),
    tab: Boolean(navigator.mediaDevices?.getDisplayMedia)
  };
}

let nextSpeechInstance = 0;

export class LiveSpeech {
  private recognition: Recognition | null = null;
  private stream: MediaStream | null = null;
  private restart: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private generation = 0;
  private session = 0;
  private failures = 0;
  private useTrack = false;
  private id = ++nextSpeechInstance;
  private callbacks: SpeechCallbacks;

  constructor(callbacks: SpeechCallbacks) { this.callbacks = callbacks; }

  async start(source: 'microphone' | 'tab') {
    this.close();
    const generation = this.generation;
    const Constructor = recognitionConstructor();
    if (!Constructor) throw new Error('Open the studio in Chrome or Edge to use live speech recognition. The motion demo works in every browser.');
    const capabilities = speechCapabilities();
    if (source === 'tab' && (!capabilities.audioTrack || !capabilities.tab)) {
      throw new Error('Tab listening needs desktop Chrome or Edge 135 or later. Open this page there, then choose this tab and enable Share tab audio.');
    }
    this.callbacks.state('starting');
    let stream: MediaStream;
    if (source === 'tab') {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include'
      } as DisplayMediaStreamOptions);
      if (!stream.getAudioTracks().length) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('No tab audio was shared. Choose a browser tab and turn on Share tab audio.');
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    }
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    this.useTrack = source === 'tab';
    this.stopped = false;
    this.failures = 0;
    stream.getTracks().forEach(track => track.addEventListener('ended', () => {
      if (!this.stopped) { this.close(); this.callbacks.ended(); }
    }));
    this.connect(Constructor);
    if (this.stopped) throw new Error('Speech recognition could not start. Try desktop Chrome or Edge.');
  }

  private connect(Constructor: RecognitionConstructor) {
    if (this.stopped) return;
    const recognition = new Constructor();
    const session = ++this.session;
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    recognition.onstart = () => this.callbacks.state('listening');
    recognition.onspeechstart = () => this.callbacks.state('processing');
    recognition.onresult = event => {
      if (this.stopped || recognition !== this.recognition) return;
      this.failures = 0;
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        this.callbacks.transcript('speech-' + this.id + '-' + session + '-' + index, result[0].transcript, result.isFinal);
      }
      this.callbacks.state('processing');
    };
    recognition.onerror = event => {
      if (this.stopped) return;
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.failures++;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture' || this.failures >= 3) {
        const message = event.error === 'not-allowed' ? 'Microphone access was not allowed. Enable it in your browser, then try again.'
          : event.error === 'network' ? 'The browser speech service could not connect. Check your connection and try again.'
          : 'The browser could not start speech recognition (' + event.error + '). Try desktop Chrome or Edge.';
        this.close();
        this.callbacks.error(message);
      }
    };
    recognition.onend = () => {
      if (!this.stopped && recognition === this.recognition) {
        this.callbacks.state('listening');
        this.restart = setTimeout(() => this.connect(Constructor), 300);
      }
    };
    try {
      if (this.useTrack) {
        const track = this.stream?.getAudioTracks()[0];
        if (!track || track.readyState !== 'live') throw new Error('The shared audio stream ended.');
        recognition.start(track);
      } else recognition.start();
    } catch (error) {
      this.close();
      this.callbacks.error(error instanceof Error ? error.message : 'Speech recognition could not start.');
    }
  }

  close() {
    this.generation++;
    this.stopped = true;
    if (this.restart) clearTimeout(this.restart);
    this.restart = null;
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) { recognition.onend = null; recognition.onresult = null; recognition.onerror = null; recognition.abort(); }
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.callbacks.state('stopped');
  }
}
