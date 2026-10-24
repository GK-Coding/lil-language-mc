import { env, pipeline } from './vendor/transformers.min.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = '/studio/vendor/';

let transcriber;
let loading;

async function load(quality) {
  if (!loading) loading = (async () => {
    const model = quality === 'accurate' ? 'onnx-community/whisper-small.en' : 'onnx-community/whisper-base.en';
    const downloads = new Map();
    const progress_callback = event => {
      if (event.status === 'progress' && event.file && event.loaded) {
        downloads.set(event.file, event.loaded);
        self.postMessage({ type: 'progress', bytes: [...downloads.values()].reduce((sum, value) => sum + value, 0) });
      }
    };
    const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
    if (adapter) {
      try {
        self.postMessage({ type: 'backend', value: 'GPU' });
        transcriber = await pipeline('automatic-speech-recognition', model, {
          device: 'webgpu', dtype: { encoder_model: quality === 'fast' && adapter.features.has('shader-f16') ? 'fp16' : 'fp32', decoder_model_merged: 'q4' }, progress_callback
        });
        return;
      } catch {
        self.postMessage({ type: 'backend', value: 'CPU' });
      }
    }
    self.postMessage({ type: 'backend', value: 'CPU' });
    transcriber = await pipeline('automatic-speech-recognition', model, { device: 'wasm', dtype: 'q8', progress_callback });
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') { await load(data.quality); self.postMessage({ type: 'ready' }); return; }
    if (!transcriber) throw new Error('The voice engine is not ready.');
    const started = performance.now();
    const result = await transcriber(data.audio, { max_new_tokens: 96, return_timestamps: false });
    const text = (Array.isArray(result) ? result[0] : result).text.trim();
    self.postMessage({ type: 'transcript', id: data.id, text, final: data.final, audio: data.audio, inferenceMs: Math.round(performance.now() - started) }, [data.audio.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'The local voice engine could not start.' });
  }
};
