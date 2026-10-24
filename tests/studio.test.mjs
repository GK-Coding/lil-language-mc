import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { analyzeRhymes } from '../lib/studio/rhyme-engine.ts';
import { TranscriptTrail, transcriptRows } from '../lib/studio/transcript.ts';
import { LiveSpeech } from '../lib/studio/speech.ts';
import { DEMO_LINES } from '../lib/studio/demo.ts';

const words = text => text.split(' ').map((text, index) => ({ id: String(index), text, at: index / 4, settled: true }));

test('the demo keeps every verse line in its own scrolling row, including short bars', () => {
  assert.equal(transcriptRows(words(DEMO_LINES.join(' '))).length, DEMO_LINES.length);
});

test('finds internal and cross-line relationships without a target word', () => {
  const input = words('A spark in the dark then a light in the night');
  const result = analyzeRhymes(input, dictionary, false);
  assert.equal(result.marks['1'].familyId, result.marks['4'].familyId);
  assert.equal(result.marks['7'].familyId, result.marks['10'].familyId);
  assert.notEqual(result.marks['1'].familyId, result.marks['7'].familyId);
});

test('identifies multiple syllables and phrases across word boundaries', () => {
  const multi = analyzeRhymes(words('motion ocean'), dictionary, false);
  assert.equal(multi.families[0].syllables, 2);
  const phrase = analyzeRhymes(words('ice cream nice dream'), dictionary, false);
  assert.equal(phrase.families[0].kind, 'phrase');
  assert.deepEqual(phrase.families[0].examples, ['ice cream', 'nice dream']);
  assert.equal(phrase.marks['0'].familyId, phrase.marks['3'].familyId);
});

test('does not infer rhymes from spelling, unknown words, filler, or repetition', () => {
  for (const text of ['cough though', 'flow flow', 'the a', 'flibberwock skibblewock']) {
    assert.equal(analyzeRhymes(words(text), dictionary, false).families.length, 0, text);
  }
});

test('unsettled words do not acquire premature highlights', () => {
  const input = words('light night');
  input[1].settled = false;
  assert.equal(analyzeRhymes(input, dictionary).families.length, 0);
  input[1].settled = true;
  assert.equal(analyzeRhymes(input, dictionary).families.length, 1);
});

test('possible rhymes are marked separately and can be disabled', () => {
  const input = words('back bag');
  assert.equal(analyzeRhymes(input, dictionary, false).families.length, 0);
  const result = analyzeRhymes(input, dictionary, true);
  assert.equal(result.families[0].kind, 'near');
  assert.equal(result.marks['0'].near, true);
});

test('rhyme family identities remain stable as unrelated words arrive', () => {
  const a = analyzeRhymes(words('light night'), dictionary, false).families[0];
  const b = analyzeRhymes(words('snow flow light night'), dictionary, false).families.find(family => family.id === a.id);
  assert.equal(a.color, b.color);
});

test('a session gives different sounds distinct colors and preserves earlier choices', () => {
  const palette = new Map();
  const first = analyzeRhymes(words('spark dark light night flow snow motion ocean'), dictionary, false, palette);
  assert.equal(new Set(first.families.map(family => family.color)).size, first.families.length);
  const later = analyzeRhymes(words('flow snow light night'), dictionary, false, palette);
  for (const family of later.families) assert.equal(family.color, first.families.find(value => value.id === family.id).color);
});

test('transcript corrections preserve stable words and replace revised ones', () => {
  const trail = new TranscriptTrail();
  const first = trail.update('turn-1', 'I find a light', false, 0);
  const corrected = trail.update('turn-1', 'I find the night', true, 1);
  assert.equal(first[0].id, corrected[0].id);
  assert.notEqual(first[2].id, corrected[2].id);
  assert.deepEqual(corrected.map(word => word.text), ['I', 'find', 'the', 'night']);
  assert.ok(corrected.every(word => word.settled));
  assert.deepEqual(trail.clear(), []);
  assert.equal(trail.update('turn-2', 'fresh session', true, 2).length, 2);
});

test('live audio uses the selected source, releases tracks, and handles cancellation', async t => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const created = [];
  class MockRecognition {
    constructor() { created.push(this); }
    start(track) { this.track = track; this.onstart?.(); }
    abort() { this.aborted = true; }
  }
  const track = kind => ({ kind, readyState: 'live', stops: 0, addEventListener() {}, stop() { this.stops++; this.readyState = 'ended'; } });
  const stream = tracks => ({ getTracks: () => tracks, getAudioTracks: () => tracks.filter(value => value.kind === 'audio') });
  const transcripts = [];
  const callbacks = { transcript: (...args) => transcripts.push(args), state() {}, error(message) { throw new Error(message); }, ended() {} };
  const setup = (mediaDevices, version = 140) => {
    created.length = 0;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { SpeechRecognition: MockRecognition } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Chrome/' + version, mediaDevices } });
  };
  try {
    await t.test('microphone sessions retain distinct transcript identities after a restart', async () => {
      const mic = track('audio');
      setup({ getUserMedia: async () => stream([mic]) });
      const a = new LiveSpeech(callbacks);
      await a.start('microphone');
      assert.equal(created[0].track, undefined);
      created[0].onresult({ resultIndex: 0, results: [{ 0: { transcript: 'light night' }, isFinal: true }] });
      a.close();
      assert.equal(mic.stops, 1);
      const b = new LiveSpeech(callbacks);
      await b.start('microphone');
      created[1].onresult({ resultIndex: 0, results: [{ 0: { transcript: 'flow snow' }, isFinal: true }] });
      assert.notEqual(transcripts[0][0], transcripts[1][0]);
      b.close();
    });
    await t.test('tab mode passes the shared track and never opens a microphone', async () => {
      const audio = track('audio'); const video = track('video'); let microphoneCalls = 0;
      setup({ getDisplayMedia: async () => stream([audio, video]), getUserMedia: async () => { microphoneCalls++; throw new Error('Wrong source'); } });
      const live = new LiveSpeech(callbacks);
      await live.start('tab');
      assert.equal(created[0].track, audio);
      assert.equal(microphoneCalls, 0);
      live.close();
      assert.equal(audio.stops, 1); assert.equal(video.stops, 1);
    });
    await t.test('unsupported tab input fails before requesting any media', async () => {
      let requested = false;
      setup({ getDisplayMedia: async () => { requested = true; return stream([]); } }, 134);
      await assert.rejects(new LiveSpeech(callbacks).start('tab'), /135/);
      assert.equal(requested, false);
    });
    await t.test('sharing without audio stops the unused video stream', async () => {
      const video = track('video');
      setup({ getDisplayMedia: async () => stream([video]) });
      await assert.rejects(new LiveSpeech(callbacks).start('tab'), /No tab audio/);
      assert.equal(video.stops, 1);
    });
    await t.test('a cancelled permission request cannot start capture later', async () => {
      let allow;
      const mic = track('audio');
      setup({ getUserMedia: () => new Promise(resolve => { allow = resolve; }) });
      const live = new LiveSpeech(callbacks);
      const pending = live.start('microphone');
      live.close();
      allow(stream([mic]));
      await pending;
      assert.equal(created.length, 0);
      assert.equal(mic.stops, 1);
    });
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else delete globalThis.window;
    if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator); else delete globalThis.navigator;
  }
});
