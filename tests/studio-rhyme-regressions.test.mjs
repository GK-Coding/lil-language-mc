// Regressions from the live freestyle QA on 25 October 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import {alignPronunciation} from '../lib/studio/pronunciation.ts';
import {analyzeRhymes,RhymeSession} from '../lib/studio/rhyme-engine.ts';
import {dictionary} from 'cmu-pronouncing-dictionary';
const words=text=>text.split(' ').map((text,i)=>({id:String(i),text,at:0,settled:true}));
const phones=text=>text.split(' ').map((token,i)=>({token,start:i*.06,end:(i+1)*.06,confidence:.96}));

test('P1: ordinary unstressed endings must not become exact rhyme anchors',()=>{
  const input=words('testing thing');
  assert.equal(analyzeRhymes(input,dictionary,false).families.length,0);
  // Synthetic phone inventory for the ordinary pronunciation, not a new recording.
  const heard=alignPronunciation(input,phones('t ɛ s t ɪ ŋ θ ɪ ŋ'),dictionary);
  const result=analyzeRhymes(input.map(w=>({...w,spoken:heard.get(w.id)})),dictionary,false);
  assert.equal(result.families.length,0,'The adapter invents IH1 in testing, then labels testing/thing an exact rhyme.');
});

test('P1: a possible rhyme must not collapse later distinct exact families',()=>{
  const input=words('see. eat.');const session=new RhymeSession();
  session.update(input,dictionary,true);
  const later=[...input,{id:'free',text:'free.',at:0,settled:true},{id:'beat',text:'beat.',at:0,settled:true}];
  const fresh=analyzeRhymes(later,dictionary,false);
  assert.equal(fresh.families.length,2);
  session.update(later,dictionary,true);
  const result=session.update(later,dictionary,false);
  assert.notEqual(result.marks['0'].familyId,result.marks['1'].familyId,'see/free and eat/beat keep one exact family after the near bridge is removed.');
});

test('P2: family examples must match currently highlighted membership',()=>{
  const input=words('flow. know. show.');const session=new RhymeSession();
  session.update(input,dictionary,false);
  const corrected=input.map(w=>w.text==='show.'?{...w,spoken:{source:'audio',confidence:.96,phones:'SH AA1'}}:w);
  const result=session.update(corrected,dictionary,false);
  assert.equal(result.marks['2'],undefined);
  assert.ok(!result.families.some(f=>f.examples.includes('show')),'The drawer still lists show after its highlight is removed.');
});

test('observed vowels keep lexical stress without reverting a bent vowel',()=>{
  const input=words('testing bag');
  const heard=alignPronunciation(input,phones('t ɛ s t ɪ ŋ b ɛ ɡ'),dictionary);
  assert.equal(heard.get('0').phones,'T EH1 S T IH0 NG');
  assert.equal(heard.get('0').stressSource,'lexicon');
  assert.equal(heard.get('1').phones,'B EH1 G');
});

test('weak endings in crazy/every do not become exact matches for see/need/feed',()=>{
  const input=words('crazy. every. see. need. feed.');
  const heard=alignPronunciation(input,phones('k ɹ eɪ z iː ɛ v ɚ iː s iː n iː d f iː d'),dictionary);
  assert.equal(heard.size,5);
  const result=analyzeRhymes(input.map(w=>({...w,spoken:heard.get(w.id)})),dictionary,false);
  assert.equal(result.marks['0'],undefined);assert.equal(result.marks['1'],undefined);
  assert.equal(result.marks['2'],undefined);
  assert.equal(result.marks['3'].familyId,result.marks['4'].familyId);
});

test('unknown multisyllable stress remains possible instead of inventing exact anchors',()=>{
  const unknown=alignPronunciation(words('zorpana'),phones('z ɔːɹ p ɑ n ə'),dictionary).get('0');
  assert.equal(unknown.stressSource,'unknown');
  assert.ok(!/[12]/.test(unknown.phones));
  const input=words('zorpana borpana').map(w=>({...w,spoken:unknown}));
  const possible=analyzeRhymes(input,dictionary,true);
  assert.equal(possible.families[0].kind,'near');
  assert.ok(Object.values(possible.marks).every(mark=>mark.near));
  assert.equal(analyzeRhymes(input,dictionary,false).families.length,0);
});

test('split exact groups retain their own colors through possible-rhyme toggles',()=>{
  const input=words('see. eat.');const session=new RhymeSession();session.update(input,dictionary,true);
  const later=[...input,{id:'free',text:'free.',at:0,settled:true},{id:'beat',text:'beat.',at:0,settled:true}];
  const first=session.update(later,dictionary,true);
  assert.notEqual(first.marks['0'].color,first.marks['1'].color);
  session.update(later,dictionary,false);
  assert.deepEqual(session.update(later,dictionary,true).marks,first.marks);
});

test('a confirmed family survives crossing the live window without duplicate occurrences',()=>{
  const input=words('light. night.');const session=new RhymeSession();
  const initial=session.update(input,dictionary,false);
  const filler=Array.from({length:340},(_,i)=>({id:'f-'+i,text:'xyzzy',at:0,settled:true}));
  for(const count of [318,319,320,321,330,340]) {
    const result=session.update([...input,...filler.slice(0,count)],dictionary,false);
    assert.deepEqual(result.marks,initial.marks);
    assert.equal(result.families[0].occurrences.length,2);
    assert.deepEqual(result.families[0].examples,['light','night']);
  }
});

test('late sound corrections also remove invalid archived examples',()=>{
  const input=words('time. rhyme.');const session=new RhymeSession();session.update(input,dictionary,false);
  const history=[...input,...Array.from({length:330},(_,i)=>({id:'f-'+i,text:'xyzzy',at:0,settled:true}))];
  session.update(history,dictionary,false);
  const corrected=history.map(w=>w.id==='1'?{...w,spoken:{source:'audio',confidence:.96,phones:'R IH1 M'}}:w);
  assert.equal(session.update(corrected,dictionary,false).families.length,0);
});

test('phrase examples are removed as complete matched spans after a correction',()=>{
  const input=words('ice cream. nice dream.');const session=new RhymeSession();
  const first=session.update(input,dictionary,false);
  assert.ok(first.families.some(f=>f.examples.includes('ice cream')));
  const corrected=input.map(w=>w.id==='0'?{...w,spoken:{source:'audio',confidence:.96,phones:'AH1 S'}}:w);
  const result=session.update(corrected,dictionary,false);
  assert.ok(!result.families.some(f=>f.examples.includes('ice cream')));
  for(const family of result.families)for(const span of family.occurrences)for(const id of span.wordIds)assert.equal(result.marks[id].familyId,family.id);
});
