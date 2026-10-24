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

test('transcript corrections preserve word identities while revising text', () => {
  const trail = new TranscriptTrail();
  const first = trail.update('turn-1', 'I find a light', false, 0);
  const corrected = trail.update('turn-1', 'I find the night', true, 1);
  assert.equal(first[0].id, corrected[0].id);
  assert.equal(first[2].id, corrected[2].id);
  assert.deepEqual(corrected.map(word => word.text), ['I', 'find', 'the', 'night']);
  assert.ok(corrected.every(word => word.settled));
  assert.deepEqual(trail.clear(), []);
  assert.equal(trail.update('turn-2', 'fresh session', true, 2).length, 2);
});
