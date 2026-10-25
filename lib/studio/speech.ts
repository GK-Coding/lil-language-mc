import { SpeechQueue, SpeechWindows } from './pcm.ts';
import type { HeardPhone } from './pronunciation';

export type SpeechCallbacks = {
  transcript: (id: string, text: string, final: boolean) => void;
  state: (state: 'starting' | 'listening' | 'processing' | 'stopped') => void;
  audio?: (analyser: AnalyserNode | null) => void;
  progress?: (megabytes: number) => void;
  backend?: (value: string) => void;
  timing?: (milliseconds: number) => void;
  pronunciation?: (id: string, phones: HeardPhone[], text: string) => void;
  soundState?: (state: 'loading' | 'ready' | 'unavailable', megabytes?: number) => void;
  error: (message: string) => void;
  ended: () => void;
};
export type VoiceEngine = 'whisper' | 'moonshine';

export function speechCapabilities() {
  return {
    microphone: typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof window.AudioContext === 'function' && typeof window.AudioWorkletNode === 'function' && typeof window.Worker === 'function',
    tab: typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  };
}

let nextSpeechInstance = 0;

export class LiveSpeech {
  private worker: Worker | null = null;
  private soundWorker: Worker | null = null;
  private soundReady = false;
  private soundBusy = false;
  private soundQueue: { id: number | string; audio: Float32Array; final: boolean; text: string }[] = [];
  private soundTimeout: ReturnType<typeof setTimeout> | null = null;
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
  private streaming = false;
  private streamBusy = false;
  private streamFinished = false;
  private finishSent = false;
  private frames: Float32Array[] = [];
  private frameSamples = 0;
  private windows = new SpeechWindows();
  private queue = new SpeechQueue();
  private id = ++nextSpeechInstance;
  private callbacks: SpeechCallbacks;

  constructor(callbacks: SpeechCallbacks) { this.callbacks = callbacks; }

  async start(input: 'microphone' | 'tab' | 'file', quality: 'accurate' | 'fast' = 'accurate', file?: File, engine: VoiceEngine = 'whisper'): Promise<boolean> {
    this.close();
    this.streaming = engine === 'moonshine';
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
      if (this.callbacks.pronunciation) this.loadSoundWorker(generation);
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
          if (this.streaming) { this.feedStream(); return; }
          const last = this.windows.flush();
          try { if (last) this.queue.push(last); this.processNext(); }
          catch (error) { this.fail(error instanceof Error ? error.message : 'Transcription fell behind.'); }
          return;
        }
        if (this.streaming) {
          this.frames.push(data); this.frameSamples += data.length;
          if (this.frameSamples > 16000 * 4) { this.fail('Moonshine cannot keep up on this device. Try Moonshine Live speed or Whisper in Studio settings.'); return; }
          this.feedStream(); return;
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
      const worker = new Worker(this.streaming ? '/studio/moonshine-worker.js' : '/studio/speech-worker.js', { type: 'module' });
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
          this.callbacks.state(this.streaming && !data.final ? 'processing' : 'listening');
          if (this.soundWorker && data.audio instanceof Float32Array) {
            // Coalesce previews; recognition of sounds never blocks the text worker.
            this.soundQueue = this.soundQueue.filter(item => item.id !== data.id);
            this.soundQueue.push({id:data.id,audio:data.audio,final:data.final,text:data.text});
            if(this.soundQueue.length>4)this.soundQueue.splice(0,this.soundQueue.length-4);
            this.processSound();
          }
          this.processNext();
        }
        if (data.type === 'consumed') { this.streamBusy = false; this.feedStream(); }
        if (data.type === 'finished') { this.streamFinished = true; this.processNext(); }
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
    if (this.streaming) {
      if (this.finishing && this.streamFinished && !this.soundBusy && !this.soundQueue.length) { this.close(); this.callbacks.ended(); }
      return;
    }
    const chunk = this.queue.shift();
    if (!chunk) {
      if (this.finishing && !this.soundBusy && !this.soundQueue.length) { this.close(); this.callbacks.ended(); }
      return;
    }
    this.busy = true;
    this.callbacks.state('processing');
    this.worker.postMessage({ type: 'transcribe', ...chunk }, [chunk.audio.buffer]);
  }

  private feedStream() {
    if (this.stopped || this.streamBusy || !this.worker) return;
    if (this.frameSamples) {
      const audio = new Float32Array(this.frameSamples);
      let offset = 0;
      for (const frame of this.frames) { audio.set(frame, offset); offset += frame.length; }
      this.frames = []; this.frameSamples = 0; this.streamBusy = true;
      this.worker.postMessage({ type: 'audio', audio }, [audio.buffer]);
    } else if (this.finishing && !this.finishSent) {
      this.finishSent = true;
      this.worker.postMessage({ type: 'finish' });
    }
  }

  private loadSoundWorker(generation: number) {
    const worker = new Worker('/studio/phoneme-worker.js', {type:'module'});
    this.soundWorker = worker;
    this.callbacks.soundState?.('loading',0);
    const unavailable = () => {
      if(generation!==this.generation)return;
      worker.terminate(); this.soundWorker=null; this.soundQueue=[];this.soundBusy=false;this.soundReady=false;
      if(this.soundTimeout)clearTimeout(this.soundTimeout);this.soundTimeout=null;
      this.callbacks.soundState?.('unavailable');this.processNext();
    };
    this.soundTimeout=setTimeout(unavailable,240000);
    worker.onerror=unavailable;
    worker.onmessage=({data})=>{
      if(generation!==this.generation)return;
      if(data.type==='progress')this.callbacks.soundState?.('loading',Math.round(data.bytes/1000000));
      if(data.type==='ready'){
        if(this.soundTimeout)clearTimeout(this.soundTimeout);this.soundTimeout=null;
        this.soundReady=true;this.callbacks.soundState?.('ready');this.processSound();
      }
      if(data.type==='pronunciation'){
        this.soundBusy=false;this.callbacks.pronunciation?.('local-'+this.id+'-'+data.id,data.phones,data.text);
        this.processSound();this.processNext();
      }
      if(data.type==='error')unavailable();
    };
    worker.postMessage({type:'load'});
  }

  private processSound() {
    if(this.stopped||!this.soundWorker||!this.soundReady||this.soundBusy)return;
    const chunk=this.soundQueue.shift();if(!chunk)return;
    this.soundBusy=true;
    this.soundWorker.postMessage({type:'recognize',...chunk},[chunk.audio.buffer]);
  }

  private fail(message: string) { this.close(); this.callbacks.error(message); }

  close() {
    this.generation++;
    this.stopped = true;
    this.cancelLoad?.(); this.cancelLoad = null;
    this.worker?.terminate(); this.worker = null;
    this.soundWorker?.terminate();this.soundWorker=null;
    if(this.soundTimeout)clearTimeout(this.soundTimeout);this.soundTimeout=null;
    this.soundQueue=[];this.soundBusy=false;this.soundReady=false;
    this.frames = []; this.frameSamples = 0; this.streamBusy = false; this.streamFinished = false; this.finishSent = false;
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
