import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dictionary} from 'cmu-pronouncing-dictionary';
import {alignPronunciation,pronunciationWords} from '../lib/studio/pronunciation.ts';
import {analyzeRhymes,RhymeSession} from '../lib/studio/rhyme-engine.ts';
const words=text=>text.split(' ').map((text,index)=>({id:String(index),text,at:0,settled:true}));
const phones=(tokens,confidence=.96)=>tokens.split(' ').map((token,index)=>({token,start:index*.06,end:(index+1)*.06,confidence}));
function heard(input,tokens,confidence){const sounds=alignPronunciation(input,phones(tokens,confidence),dictionary);return input.map(word=>({...word,spoken:sounds.get(word.id)}));}

test('a bent vowel is matched to the recording rather than the dictionary',()=>{
  const input=words('bag leg');
  assert.equal(analyzeRhymes(input,dictionary,false).families.length,0);
  const spoken=heard(input,'b ɛ ɡ l ɛ ɡ');
  assert.equal(spoken[0].spoken.phones,'B EH1 G');
  const result=analyzeRhymes(spoken,dictionary,false);
  assert.equal(result.marks['0'].familyId,result.marks['1'].familyId);
});
test('a confident recording can rule out a dictionary rhyme',()=>{
  const input=words('time rhyme');
  assert.equal(analyzeRhymes(input,dictionary,false).families.length,1);
  assert.equal(analyzeRhymes(heard(input,'t iː m ɹ aɪ m'),dictionary,false).families.length,0);
});
test('slang absent from the dictionary can carry an observed sound',()=>{
  const slang=heard(words('zorp'),'z ɔːɹ p')[0];
  assert.equal(dictionary.zorp,undefined);
  assert.equal(slang.spoken.phones,'Z AO1 R P');
  const input=[slang,{id:'corp',text:'corp',at:0,settled:true}];
  const result=analyzeRhymes(input,dictionary,false);
  assert.equal(result.marks['0'].familyId,result.marks.corp.familyId);
});
test('uncertain audio and unsupported labels do not override the dictionary',()=>{
  assert.equal(heard(words('bag'),'b ɛ ɡ',.3)[0].spoken,undefined);
  assert.equal(heard(words('bag'),'?? ?? ??')[0].spoken,undefined);
  assert.equal(heard(words('bag'),'s uː n')[0].spoken,undefined);
});
test('a late acoustic correction removes an obsolete highlight without changing the words',()=>{
  const input=words('time rhyme');const session=new RhymeSession();
  assert.equal(session.update(input,dictionary,false).families.length,1);
  const corrected=heard(input,'t iː m ɹ aɪ m');
  const result=session.update(corrected,dictionary,false);
  assert.equal(result.families.length,0);assert.deepEqual(corrected.map(w=>w.text),['time','rhyme']);
});
test('new words in a revised hypothesis cannot shift sound annotations onto another word',()=>{
  const published=words('I write at night');
  const aligned=pronunciationWords(published,'I can right at night',dictionary);
  assert.equal(aligned[1].id,'pending-sound-1');
  assert.equal(aligned[2].id,published[1].id); // right/write are homophones
  assert.equal(aligned[4].id,published[3].id);
});
for (const fixtureName of ['studio-heard-phones.json','studio-heard-incremental.json']) test('real local CTC output retains the sample’s intended rhymes: '+fixtureName,async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/'+fixtureName,import.meta.url),'utf8'));
  const input=words('I find the light and write into the night. I keep the flow and let the whole thing grow. I leave a spark, a little mark inside the dark. I keep the pace and make a space for every face.');
  const sounds=alignPronunciation(input,fixture.phones,dictionary);
  assert.ok(sounds.size>=27);
  const result=analyzeRhymes(input.map(w=>({...w,spoken:sounds.get(w.id)})),dictionary,true);
  for(const pair of [['light','night.'],['flow','grow.'],['spark,','dark.'],['pace','face.']]){
    const ids=pair.map(text=>input.find(w=>w.text===text).id);
    assert.equal(result.marks[ids[0]].familyId,result.marks[ids[1]].familyId,pair.join('/'));
  }
});

test('acoustic windows reuse the earlier recording and retain overlap across model boundaries',async()=>{
  const {PhoneWindows}=await import('../public/studio/phone-windows.js');
  const trail=new PhoneWindows();
  const first=trail.plan(1,48000);assert.equal(first.length,1);
  trail.append([{token:'aɪ',start:2.65,end:2.85,confidence:.9},{token:'t',start:2.9,end:2.98,confidence:.8}],first[0]);
  const next=trail.plan(1,64000);assert.equal(next[0].start,41600);assert.equal(next[0].end,64000);
  const merged=trail.append([{token:'aɪ',start:2.65,end:2.86,confidence:.95},{token:'t',start:2.9,end:2.98,confidence:.9},{token:'n',start:3.2,end:3.4,confidence:.9}],next[0]);
  assert.deepEqual(merged.map(phone=>phone.token),['aɪ','t','n']);
  const reset=trail.plan(2,20000);assert.equal(reset[0].start,0);assert.equal(trail.phones.length,0);
});
