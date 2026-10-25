import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { LiveSpeech } from '../lib/studio/speech.ts';
import { SpeechQueue, SpeechWindows } from '../lib/studio/pcm.ts';
import { TranscriptTrail, transcriptRows } from '../lib/studio/transcript.ts';

test('inserting words and changing punctuation does not restart existing words', () => {
  const trail = new TranscriptTrail();
  const before = trail.update('a', 'I find the light in the night', false, 0);
  const after = trail.update('a', 'I always find the light, in the night.', false, 1);
  for (let i = 1; i < before.length; i++) assert.equal(before[i].id, after[i + 1].id);
  const repeated = trail.update('a', 'I always find the light, in the night.', false, 2);
  assert.equal(repeated[4].settled, true);
  assert.equal(repeated.at(-1).settled, false);
});


test('row identities survive an insertion into a long utterance', () => {
  const trail = new TranscriptTrail();
  const text = 'I find the light and write into the night and keep a steady flow while making every little rhyme grow';
  const before = transcriptRows(trail.update('a', text, false, 0));
  const after = transcriptRows(trail.update('a', 'Well ' + text, true, 1));
  assert.deepEqual(before.map(row => row.id), after.map(row => row.id));
});

test('a shorter final hypothesis cannot erase a repeatedly confirmed phrase', () => {
  const trail = new TranscriptTrail();
  const phrase = 'And so my fellow Americans ask not what your country can do for you ask what you can do for your country';
  trail.update('a', phrase, false, 0);
  trail.update('a', phrase, false, 1);
  const final = trail.update('a', 'And so my fellow Americans ask not what your country can do for your country', true, 2);
  assert.equal(final.map(word => word.text).join(' '), phrase);
});

test('silence stays silent and long speech produces bounded revisable windows', () => {
  const windows = new SpeechWindows();
  for (let i = 0; i < 50; i++) assert.equal(windows.push(new Float32Array(2048)), null);
  const chunks = [];
  for (let i = 0; i < 105; i++) { const value = windows.push(new Float32Array(2048).fill(.1)); if (value) chunks.push(value); }
  assert.ok(chunks.some(value => value.final));
  assert.ok(chunks.every(value => value.audio.length <= 194048));
  assert.equal(chunks[0].id, chunks.find(value => value.final).id);
  assert.ok(windows.flush()?.final);
});

test('obsolete previews coalesce without discarding final utterances', () => {
  const queue = new SpeechQueue();
  const chunk = (id, final) => ({ id, final, audio: new Float32Array(1) });
  queue.push(chunk(1, false)); queue.push(chunk(1, false)); queue.push(chunk(1, true)); queue.push(chunk(2, false));
  assert.equal(queue.shift().final, true);
  assert.equal(queue.shift().id, 2);
  assert.equal(queue.shift(), undefined);
  for (let i = 0; i < 4; i++) queue.push(chunk(i, true));
  assert.throws(() => queue.push(chunk(5, true)), /cannot keep up/);
});

test('the capture worklet resamples 48 kHz stereo to 16 kHz mono without changing duration or amplitude', async () => {
  let Processor;
  const frames = [];
  const scope = {
    sampleRate: 48000, Float32Array,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: value => frames.push(value) }; } },
    registerProcessor(name, constructor) { Processor = constructor; }
  };
  vm.runInNewContext(await readFile(new URL('../public/studio/capture-worklet.js', import.meta.url), 'utf8'), scope);
  const capture = new Processor();
  for (let i = 0; i < 375; i++) capture.process([[new Float32Array(128).fill(.3), new Float32Array(128).fill(.1)]]);
  capture.port.onmessage();
  const samples = frames.filter(value => value instanceof Float32Array);
  assert.equal(samples.reduce((sum, value) => sum + value.length, 0), 16000);
  assert.ok(samples.every(value => Math.abs(value[0] - .2) < .00001));
});

test('local capture monitors the selected input and closes every resource', async t => {
  const names = ['window', 'navigator', 'AudioContext', 'AudioWorkletNode', 'Worker'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const workers = []; const contexts = []; const captures = [];
  let automaticReady = true;
  class Node {
    connect(next) { return next; }
    disconnect() { this.disconnected = true; }
  }
  class Context {
    constructor() { contexts.push(this); this.destination = {}; this.audioWorklet = { addModule: async () => {} }; }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
    createAnalyser() { return new Node(); }
    createGain() { const node = new Node(); node.gain = { value: 0 }; return node; }
    createMediaStreamSource(stream) { this.input = stream; return new Node(); }
  }
  class Capture extends Node {
    constructor() { super(); this.port = { onmessage: null }; captures.push(this); }
  }
  class Worker {
    constructor(url) { workers.push(this); this.url=url; this.messages = []; }
    postMessage(value) { this.messages.push(value); if (value.type === 'load' && automaticReady) queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })); }
    terminate() { this.terminated = true; }
  }
  const track = kind => ({ kind, stops: 0, addEventListener() {}, stop() { this.stops++; } });
  const stream = tracks => ({ getTracks: () => tracks, getAudioTracks: () => tracks.filter(value => value.kind === 'audio') });
  const transcripts = []; const analysers = [];
  const callbacks = { transcript: (...args) => transcripts.push(args), audio: value => analysers.push(value), state() {}, error() {}, ended() {} };
  const setup = mediaDevices => {
    workers.length = 0; contexts.length = 0; captures.length = 0; automaticReady = true;
    for (const [name, value] of Object.entries({ window: { AudioContext: Context, AudioWorkletNode: Capture, Worker }, navigator: { mediaDevices }, AudioContext: Context, AudioWorkletNode: Capture, Worker })) Object.defineProperty(globalThis, name, { configurable: true, value });
  };
  try {
    await t.test('microphone input connects to a real analyser and worker', async () => {
      const mic = track('audio'); const input = stream([mic]);
      setup({ getUserMedia: async () => input });
      const live = new LiveSpeech(callbacks);
      assert.equal(await live.start('microphone'), true);
      assert.equal(contexts[0].input, input);
      assert.ok(analysers.at(-1));
      captures[0].port.onmessage({ data: new Float32Array(22000).fill(.1) });
      assert.equal(workers[0].messages.at(-1).type, 'transcribe');
      workers[0].onmessage({ data: { type: 'transcript', id: 1, text: 'light night', final: true } });
      assert.equal(transcripts.at(-1)[1], 'light night');
      live.close();
      assert.equal(mic.stops, 1); assert.ok(workers[0].terminated); assert.ok(contexts[0].closed); assert.equal(analysers.at(-1), null);
    });
    await t.test('sound analysis runs beside transcription and both workers are cancelled together', async () => {
      const mic=track('audio');setup({getUserMedia:async()=>stream([mic])});
      const heard=[];const live=new LiveSpeech({...callbacks,pronunciation:(...args)=>heard.push(args)});
      await live.start('microphone');
      const sound=workers.find(worker=>worker.url.includes('phoneme'));
      const text=workers.find(worker=>worker.url.includes('speech-worker'));
      captures[0].port.onmessage({data:new Float32Array(22000).fill(.1)});
      text.onmessage({data:{type:'transcript',id:1,text:'bag leg',final:false,audio:new Float32Array(22000)}});
      assert.equal(sound.messages.at(-1).type,'recognize');
      captures[0].port.onmessage({data:new Float32Array(9000).fill(.1)});
      assert.equal(text.messages.filter(message=>message.type==='transcribe').length,2);
      sound.onmessage({data:{type:'pronunciation',id:1,text:'bag leg',phones:[{token:'b',confidence:.9}]}});
      assert.equal(heard.length,1);assert.equal(heard[0][2],'bag leg');
      live.close();assert.ok(sound.terminated);assert.ok(text.terminated);assert.equal(mic.stops,1);
    });
    await t.test('a sound model failure is visible and leaves transcription available', async () => {
      setup({getUserMedia:async()=>stream([track('audio')])});const states=[];
      const live=new LiveSpeech({...callbacks,pronunciation(){},soundState:state=>states.push(state)});
      await live.start('microphone');
      const sound=workers.find(worker=>worker.url.includes('phoneme'));
      const text=workers.find(worker=>worker.url.includes('speech-worker'));
      sound.onmessage({data:{type:'error',message:'model unavailable'}});
      assert.equal(states.at(-1),'unavailable');assert.ok(sound.terminated);assert.ok(!text.terminated);
      captures[0].port.onmessage({data:new Float32Array(22000).fill(.1)});
      assert.equal(text.messages.at(-1).type,'transcribe');live.close();
    });
    await t.test('Moonshine receives each PCM sample once and finishes only after queued audio is consumed', async () => {
      const mic=track('audio');setup({getUserMedia:async()=>stream([mic])});let ended=0;
      const live=new LiveSpeech({...callbacks,ended:()=>ended++});
      await live.start('microphone','accurate',undefined,'moonshine');
      const worker=workers[0];assert.equal(worker.url,'/studio/moonshine-worker.js');
      captures[0].port.onmessage({data:new Float32Array(2048).fill(.1)});
      captures[0].port.onmessage({data:new Float32Array(4096).fill(.2)});
      captures[0].port.onmessage({data:new Float32Array(1024).fill(.3)});
      assert.equal(worker.messages.filter(message=>message.type==='audio').length,1);
      worker.onmessage({data:{type:'consumed'}});
      const combined=worker.messages.at(-1).audio;
      assert.equal(combined.length,5120);assert.ok(Math.abs(combined[0]-.2)<.0001);assert.ok(Math.abs(combined[4096]-.3)<.0001);
      captures[0].port.onmessage({data:{type:'flushed'}});
      assert.notEqual(worker.messages.at(-1).type,'finish');
      worker.onmessage({data:{type:'consumed'}});assert.equal(worker.messages.at(-1).type,'finish');
      worker.onmessage({data:{type:'transcript',id:'18446744073709551614',text:'light night',final:true}});
      assert.ok(transcripts.at(-1)[0].endsWith('18446744073709551614'));
      worker.onmessage({data:{type:'finished'}});
      assert.equal(ended,1);assert.ok(worker.terminated);assert.equal(mic.stops,1);
    });
    await t.test('a stalled streaming decoder has a bounded backlog and releases capture', async () => {
      const mic=track('audio');setup({getUserMedia:async()=>stream([mic])});const failures=[];
      const live=new LiveSpeech({...callbacks,error:message=>failures.push(message)});
      await live.start('microphone','accurate',undefined,'moonshine');
      captures[0].port.onmessage({data:new Float32Array(2048).fill(.1)});
      captures[0].port.onmessage({data:new Float32Array(65000).fill(.1)});
      assert.match(failures[0],/cannot keep up/);assert.ok(workers[0].terminated);assert.equal(mic.stops,1);
    });
    await t.test('tab mode never silently requests the microphone', async () => {
      const audio = track('audio'); const video = track('video'); let micRequests = 0;
      const input = stream([audio, video]);
      setup({ getDisplayMedia: async () => input, getUserMedia: async () => { micRequests++; return input; } });
      const live = new LiveSpeech(callbacks);
      await live.start('tab');
      assert.equal(contexts[0].input, input); assert.equal(micRequests, 0);
      live.close(); assert.equal(audio.stops, 1); assert.equal(video.stops, 1);
    });
    await t.test('a share without audio stops all tracks', async () => {
      const video = track('video');
      setup({ getDisplayMedia: async () => stream([video]), getUserMedia: async () => stream([]) });
      await assert.rejects(new LiveSpeech(callbacks).start('tab'), /No audio/);
      assert.equal(video.stops, 1); assert.ok(contexts[0].closed);
    });
    await t.test('cancelled permission cannot open a worker or reactivate listening', async () => {
      let allow; const mic = track('audio');
      setup({ getUserMedia: () => new Promise(resolve => { allow = resolve; }) });
      const live = new LiveSpeech(callbacks); const pending = live.start('microphone');
      live.close(); allow(stream([mic]));
      assert.equal(await pending, false); assert.equal(workers.length, 0); assert.equal(mic.stops, 1); assert.ok(contexts[0].closed);
    });
    await t.test('cancel during model loading releases the input and terminates loading', async () => {
      const mic = track('audio'); setup({ getUserMedia: async () => stream([mic]) }); automaticReady = false;
      const live = new LiveSpeech(callbacks); const pending = live.start('microphone');
      await new Promise(resolve => setImmediate(resolve));
      live.close(); assert.equal(await pending, false); assert.ok(workers[0].terminated); assert.equal(mic.stops, 1);
    });
  } finally {
    for (const name of names) { const descriptor = saved.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
