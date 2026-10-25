import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { analyzeRhymes, RhymeSession } from '../lib/studio/rhyme-engine.ts';
import { TranscriptTrail, StableTranscript } from '../lib/studio/transcript.ts';
const words = text => text.split(' ').map((text, index) => ({ id: String(index), text, at: 0, settled: true }));

test('secondary stress connects freestyle to while and smile', () => {
  const result = analyzeRhymes(words('freestyle while smile'), dictionary, false);
  assert.equal(result.marks['0'].familyId, result.marks['1'].familyId);
  assert.equal(result.marks['1'].familyId, result.marks['2'].familyId);
});
test('the reported freestyle/while example is not swallowed by overlapping or repeated phrases', () => {
  const input = words('want to do this long before a while. I am talking about the freestyle doing this for a while.');
  const result = analyzeRhymes(input, dictionary, false);
  const freestyle = input.find(word => word.text === 'freestyle');
  for (const word of input.filter(word => word.text === 'while.')) assert.equal(result.marks[word.id].familyId, result.marks[freestyle.id].familyId);
});
test('a single word can rhyme across a real word boundary', () => {
  const result = analyzeRhymes(words('somebody some body'), dictionary, false);
  assert.equal(result.families[0].kind, 'phrase');
  assert.deepEqual(result.families[0].examples, ['somebody', 'some body']);
});
test('one phrase cannot rhyme with an overlapping version of itself', () => {
  assert.equal(analyzeRhymes(words('cat dog red blue'), dictionary, false).families.length, 0);
});
test('a near rhyme can join an established exact family', () => {
  const result = analyzeRhymes(words('back sack bag'), dictionary, true);
  assert.equal(result.marks['2'].familyId, result.marks['0'].familyId);
  assert.equal(result.marks['2'].near, true);
  assert.equal(result.marks['0'].near, false);
});
test('spoken -in contractions and reduced unstressed vowels are supported as possible rhymes', () => {
  const result = analyzeRhymes(words("rappin' happen"), dictionary, true);
  assert.equal(result.families[0].kind, 'near');
});
test('unrelated vowels, invented words and identical repetitions stay unmarked', () => {
  for (const text of ['cat dog', 'cough though', 'orange time', 'while while', 'flibberwock skibblewock']) assert.equal(analyzeRhymes(words(text), dictionary, true).families.length, 0, text);
});
test('historical highlights survive the live window and possible rhymes can be removed', () => {
  const session = new RhymeSession();
  const input = words('light night back bag');
  const first = session.update(input, dictionary);
  const history = [...input, ...Array.from({length: 400}, (_, i) => ({id: 'new-' + i, text: 'xyzzy', at: 0, settled: true}))];
  const later = session.update(history, dictionary);
  assert.deepEqual(later.marks['0'], first.marks['0']);
  assert.deepEqual(later.marks['1'], first.marks['1']);
  const exactOnly = session.update(history, dictionary, false);
  assert.equal(exactOnly.marks['2'], undefined);
  assert.ok(exactOnly.marks['0']);
});
test('the particle frontier withholds unstable tails and published words never retract or change', () => {
  const stable = new StableTranscript();
  const raw = words('I find a light').map(word => ({...word, segment:'a', settled: Number(word.id) < 2}));
  const first = stable.update(raw, 1);
  assert.equal(first.words.map(word=>word.text).join(' '), 'I find');
  assert.equal(first.pending, 2);
  const revised = raw.map(word=>({...word, text: word.id === '1' ? 'found' : word.id === '3' ? 'night' : word.text, settled:true}));
  const final = stable.update(revised, 2);
  assert.equal(final.words.map(word=>word.text).join(' '), 'I find a night');
  assert.equal(final.words[0].at, 1);
  assert.equal(final.words[3].at, 2);
  assert.deepEqual(stable.update(revised.slice(0, 1), 3).words, final.words);
});
test('scrollback keeps the complete session beyond the old 100-segment cutoff', () => {
  const trail = new TranscriptTrail(); let result;
  for(let i=0;i<120;i++) result = trail.update('segment-'+i, 'a remembered line', true, i);
  assert.equal(result.length, 360);
  assert.equal(result[0].segment, 'segment-0');
});

test('shared articles do not acquire highlights from light/night', () => {
  const input = words('I find the light and write into the night');
  const result = analyzeRhymes(input, dictionary, false);
  assert.equal(result.marks['2'], undefined);
  assert.equal(result.marks['7'], undefined);
  assert.equal(result.marks['3'].familyId, result.marks['8'].familyId);
});

test('a substituted confirmed word is not duplicated in a later streaming hypothesis',()=>{
  const trail=new TranscriptTrail(),stable=new StableTranscript();
  for(const text of ['I find the light and write into it','I find the light and write into the night'])stable.update(trail.update('live',text,false,1),1);
  const result=stable.update(trail.update('live','I find the light then ride into the night',true,2),2);
  assert.equal(result.words.length,9);
  assert.equal(result.words.map(word=>word.text).join(' '),'I find the light and write into the night');
});
