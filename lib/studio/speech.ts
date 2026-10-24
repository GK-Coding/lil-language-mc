import { SpeechQueue, SpeechWindows } from './pcm.ts';

export type SpeechCallbacks = {
  transcript: (id: string, text: string, final: boolean) => void;
  state: (state: 'starting' | 'listening' | 'processing' | 'stopped') => void;
  audio?: (analyser: AnalyserNode | null) => void;
  progress?: (megabytes: number) => void;
  backend?: (value: string) => void;
  timing?: (milliseconds: number) => void;
  error: (message: string) => void;
  ended: () => void;
};

export function speechCapabilities() {
  return {
    microphone: typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.AudioContext === 'function' && typeof window.AudioWorkletNode === 'function' && typeof window.Worker === 'function',
    tab: typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  };
}

let nextSpeechInstance = 0;

export class LiveSpeech {
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private silent: GainNode | null = null;
  private cancelLoad: (() => void) | null = null;
  private generation = 0;
  private stopped = true;
  private busy = false;
  private finishing = false;
  private windows = new SpeechWindows();
  private queue = new SpeechQueue();
  private id = ++nextSpeechInstance;
  private callbacks: SpeechCallbacks;

  constructor(callbacks: SpeechCallbacks) { this.callbacks = callbacks; }

  async start(input: 'microphone' | 'tab' | 'file', quality: 'accurate' | 'fast' = 'accurate', file?: File): Promise<boolean> {
    this.close();
    const generation = this.generation;
    if (!speechCapabilities().microphone) throw new Error('This browser cannot capture audio for local transcription. Open the studio in a current desktop browser.');
    if (input === 'tab' && !speechCapabilities().tab) throw new Error('This browser cannot share tab audio. Open the studio in desktop Chrome or Edge.');
    this.callbacks.state('starting');
    this.callbacks.progress?.(0);
    this.stopped = false;
    const context = new AudioContext();
    this.context = context;
    // Request audio while the source-selection click still has user activation.
    const resume = context.resume().catch(() => {});
    const request = input === 'file' ? null : input === 'tab'
      ? navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' } as DisplayMediaStreamOptions)
      : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }, video: false });
    try {
      let buffer: AudioBuffer | undefined;
      if (input === 'file') {
        if (!file || file.size > 100 * 1024 * 1024) throw new Error('Choose an audio file smaller than 100 MB.');
        buffer = await context.decodeAudioData(await file.arrayBuffer());
        if (buffer.duration > 300) throw new Error('Choose an audio clip up to five minutes long.');
      } else {
        const stream = await request!;
        if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
        this.stream = stream;
        if (!stream.getAudioTracks().length) throw new Error('No audio was shared. Choose a browser tab and enable Share tab audio.');
        stream.getTracks().forEach(track => track.addEventListener('ended', () => {
          if (!this.stopped) { this.close(); this.callbacks.ended(); }
        }));
      }
      if (generation !== this.generation) return false;
      await resume;
      this.analyser = context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.65;
      this.silent = context.createGain();
      this.silent.gain.value = 0;
      this.analyser.connect(this.silent).connect(context.destination);
      const source = buffer ? context.createBufferSource() : context.createMediaStreamSource(this.stream!);
      this.source = source;
      source.connect(this.analyser);
      this.callbacks.audio?.(this.analyser);
      await this.loadWorker(generation, quality);
      if (generation !== this.generation) return false;
      await context.audioWorklet.addModule('/studio/capture-worklet.js');
      if (generation !== this.generation) return false;
      this.capture = new AudioWorkletNode(context, 'studio-capture');
      source.connect(this.capture).connect(this.silent);
      this.capture.port.onmessage = ({ data }: MessageEvent<Float32Array | { type: string }>) => {
        if (generation !== this.generation) return;
        if (!(data instanceof Float32Array)) {
          this.finishing = true;
          const last = this.windows.flush();
          try { if (last) this.queue.push(last); this.processNext(); }
          catch (error) { this.fail(error instanceof Error ? error.message : 'Transcription fell behind.'); }
          return;
        }
        const chunk = this.windows.push(data);
        if (chunk) {
          try { this.queue.push(chunk); this.processNext(); }
          catch (error) { this.fail(error instanceof Error ? error.message : 'Transcription fell behind.'); }
        }
      };
      if (buffer) {
        const audio = source as AudioBufferSourceNode;
        audio.buffer = buffer;
        audio.connect(context.destination);
        audio.onended = () => this.capture?.port.postMessage({ type: 'flush' });
        audio.start();
      }
      this.callbacks.state('listening');
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.close();
      throw error;
    }
  }

  private loadWorker(generation: number, quality: 'accurate' | 'fast') {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker('/studio/speech-worker.js', { type: 'module' });
      this.worker = worker;
      const timeout = setTimeout(() => finish(new Error('The voice model download timed out. Check your connection, then try again.')), 240000);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); this.cancelLoad = null;
        if (error) reject(error); else resolve();
      };
      this.cancelLoad = () => finish(new DOMException('Listening cancelled.', 'AbortError'));
      worker.onerror = () => {
        if (generation !== this.generation) return;
        const message = 'The local voice engine could not load. Reload the page and try again.';
        if (!settled) finish(new Error(message)); else this.fail(message);
      };
      worker.onmessage = ({ data }) => {
        if (generation !== this.generation) return;
        if (data.type === 'ready') finish();
        if (data.type === 'progress') this.callbacks.progress?.(Math.round(data.bytes / 1000000));
        if (data.type === 'backend') this.callbacks.backend?.(data.value);
        if (data.type === 'transcript') {
          this.busy = false;
          if (data.text) this.callbacks.transcript('local-' + this.id + '-' + data.id, data.text, data.final);
          this.callbacks.timing?.(data.inferenceMs);
          this.callbacks.state('listening');
          this.processNext();
        }
        if (data.type === 'error') {
          const message = 'Local transcription could not start. ' + (data.message || 'Reload and try again.');
          if (!settled) finish(new Error(message)); else this.fail(message);
        }
      };
      worker.postMessage({ type: 'load', quality });
    });
  }

  private processNext() {
    if (this.stopped || this.busy || !this.worker) return;
    const chunk = this.queue.shift();
    if (!chunk) {
      if (this.finishing) { this.close(); this.callbacks.ended(); }
      return;
    }
    this.busy = true;
    this.callbacks.state('processing');
    this.worker.postMessage({ type: 'transcribe', ...chunk }, [chunk.audio.buffer]);
  }

  private fail(message: string) { this.close(); this.callbacks.error(message); }

  close() {
    this.generation++;
    this.stopped = true;
    this.cancelLoad?.(); this.cancelLoad = null;
    this.worker?.terminate(); this.worker = null;
    if (this.capture) this.capture.port.onmessage = null;
    if (this.source && 'stop' in this.source) { this.source.onended = null; try { this.source.stop(); } catch {} }
    this.source?.disconnect(); this.analyser?.disconnect(); this.capture?.disconnect(); this.silent?.disconnect();
    this.source = null; this.analyser = null; this.capture = null; this.silent = null;
    this.callbacks.audio?.(null);
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    void this.context?.close().catch(() => {}); this.context = null;
    this.windows = new SpeechWindows(); this.queue = new SpeechQueue(); this.busy = false; this.finishing = false;
    this.callbacks.state('stopped');
  }
}
