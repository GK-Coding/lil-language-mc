import { AutoModelForCTC, AutoProcessor, env } from './vendor/transformers.min.js';
import { PhoneWindows } from './phone-windows.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = '/studio/vendor/';
const MODEL = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX';
const REVISION = 'c69750f5043e5e1f8a71ab95dd3b98338c280c92';
let model, processor, tokens;
const trail = new PhoneWindows();

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      const downloads = new Map();
      model = await AutoModelForCTC.from_pretrained(MODEL, { revision: REVISION, dtype: 'q8', device: 'wasm', progress_callback: event => {
        if (event.status === 'progress' && event.file && event.loaded) {
          downloads.set(event.file, event.loaded);
          self.postMessage({type:'progress', bytes:[...downloads.values()].reduce((a,b)=>a+b,0)});
        }
      } });
      processor = await AutoProcessor.from_pretrained(MODEL, {revision:REVISION});
      const cache = await caches.open('llmc-pronunciation-v1');
      const url = `https://huggingface.co/${MODEL}/resolve/${REVISION}/vocab.json`;
      let response = await cache.match(url);
      if (!response) { response = await fetch(url); if(!response.ok)throw new Error('Sound vocabulary could not load.'); await cache.put(url,response.clone()); }
      const vocab = await response.json();
      tokens = Object.fromEntries(Object.entries(vocab).map(([token,id])=>[id,token]));
      self.postMessage({type:'ready'}); return;
    }
    const started = performance.now();
    for (const window of trail.plan(data.id, data.audio.length)) {
    const {logits} = await model(await processor(data.audio.slice(window.start, window.end)));
    const [,frames,size] = logits.dims;
    const phones = []; let previous=-1;
    for(let frame=0;frame<frames;frame++) {
      let best=0;
      for(let id=1;id<size;id++)if(logits.data[frame*size+id]>logits.data[frame*size+best])best=id;
      let sum=0; const maximum=logits.data[frame*size+best];
      for(let id=0;id<size;id++)sum+=Math.exp(logits.data[frame*size+id]-maximum);
      const offset = window.start / 16000;
      if(best>3&&best!==previous)phones.push({token:tokens[best],start:offset+frame*.02,end:offset+(frame+1)*.02,confidence:1/sum});
      else if(best>3&&best===previous) { const phone=phones[phones.length-1]; phone.end=offset+(frame+1)*.02;phone.confidence=Math.max(phone.confidence,1/sum); }
      previous=best;
    }
    trail.append(phones,window);
    }
    self.postMessage({type:'pronunciation',id:data.id,text:data.text,phones:trail.phones,inferenceMs:Math.round(performance.now()-started)});
  } catch(error) { self.postMessage({type:'error',message:error instanceof Error?error.message:'Pronunciation recognition failed.'}); }
};
