import { Transcriber, ModelArch } from './vendor/moonshine/index.js';
import { StreamHistory } from './stream-history.js';

let transcriber, stream;
const history = new StreamHistory();
let sequence = Promise.resolve();

function publish(line, final) {
  if (!line.text?.trim()) return;
  const audio = history.slice(line.startTime, line.duration);
  self.postMessage({
    type: 'transcript', id: line.id, text: line.text.trim(), final,
    inferenceMs: Math.round(line.lastTranscriptionLatencyMs || 0), audio,
  }, audio ? [audio.buffer] : []);
}

async function handle(data) {
  if (data.type === 'load') {
    if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
      throw new Error('Moonshine needs the studio’s streaming setup. Reload this page, or choose Whisper in Studio settings.');
    }
    self.postMessage({ type: 'backend', value: 'CPU · streaming' });
    transcriber = await Transcriber.load({
      language: 'en',
      modelArch: data.quality === 'fast' ? ModelArch.SmallStreaming : ModelArch.MediumStreaming,
      options: { transcription_interval: '0.25' },
      onProgress: loaded => self.postMessage({ type: 'progress', bytes: loaded }),
    });
    stream = transcriber.createStream({ updateInterval: .25 });
    stream.addListener({
      onLineTextChanged: ({ line }) => publish(line, false),
      onLineCompleted: ({ line }) => publish(line, true),
    });
    stream.start();
    self.postMessage({ type: 'ready' });
    return;
  }
  if (!stream) throw new Error('Moonshine is not ready.');
  if (data.type === 'audio') {
    history.push(data.audio);
    stream.addAudio(data.audio, 16000);
    stream.transcribe();
    self.postMessage({ type: 'consumed' });
  }
  if (data.type === 'finish') {
    stream.stop();
    self.postMessage({ type: 'finished' });
  }
}

self.onmessage = ({ data }) => {
  sequence = sequence.then(() => handle(data)).catch(error => {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Moonshine could not start.' });
  });
};
