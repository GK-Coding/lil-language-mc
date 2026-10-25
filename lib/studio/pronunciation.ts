import type { Lexicon, StudioWord } from './rhyme-engine';

export type HeardPhone = { token: string; start: number; end: number; confidence: number };
export type SpokenSound = { phones: string; confidence: number; source: 'audio'; stressSource?: 'lexicon' | 'monosyllable' | 'unknown' };
type Phone = { value: string; confidence: number; stress?: number };
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/;
// The recognizer's espeak labels describe the recording, independently of ASR text.
// Map the English inventory only; unrecognized labels stay unknown, never guessed.
const IPA: Record<string, string> = {
  'aɪ':'AY','aʊ':'AW','eɪ':'EY','oʊ':'OW','əʊ':'OW','ɔɪ':'OY','oɪ':'OY',
  'ɑːɹ':'AA R','ɔːɹ':'AO R','oːɹ':'OW R','ɛɹ':'EH R','ɪɹ':'IH R','ʊɹ':'UH R',
  'aɪɚ':'AY ER','aɪə':'AY AH','əl':'AH L','iə':'IY AH','eə':'EH AH','ʊə':'UH AH',
  'dʒ':'JH','tʃ':'CH','ɑː':'AA','ɑ':'AA','a':'AA','aː':'AA','ɒ':'AA',
  'æ':'AE','æː':'AE','ʌ':'AH','ə':'AH','ɐ':'AH','ᵻ':'IH','ɪ':'IH','i':'IY','iː':'IY',
  'ɛ':'EH','ɛː':'EH','e':'EH','eː':'EY','ɔ':'AO','ɔː':'AO','o':'OW','oː':'OW',
  'ɚ':'ER','ɜ':'ER','ɜː':'ER','u':'UW','uː':'UW','ʊ':'UH',
  'p':'P','b':'B','t':'T','d':'D','k':'K','ɡ':'G','g':'G','f':'F','v':'V','θ':'TH','ð':'DH',
  's':'S','z':'Z','ʃ':'SH','ʒ':'ZH','h':'HH','m':'M','n':'N','ŋ':'NG','l':'L','ɫ':'L',
  'ɹ':'R','r':'R','ɻ':'R','w':'W','j':'Y','ɾ':'D',
};
const normalize = (text: string) => text.toLowerCase().replace(/’/g,"'").replace(/^[^a-z']+|[^a-z']+$/g,'').replace(/'$/,'');

/** Link acoustic results to published identities despite insertions in a later ASR hypothesis. */
export function pronunciationWords(published: StudioWord[], text: string, lexicon: Lexicon): StudioWord[] {
  const parts=text.trim().split(/\s+/), n=published.length,m=parts.length;
  if(n>110||m>110)return [];
  const equal=(a:string,b:string)=>normalize(a)===normalize(b)||(lexicon[normalize(a)]&&lexicon[normalize(a)]===lexicon[normalize(b)]);
  const cost=Array.from({length:n+1},()=>new Uint16Array(m+1));
  for(let i=0;i<=n;i++)cost[i][0]=i;
  for(let j=0;j<=m;j++)cost[0][j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)cost[i][j]=Math.min(cost[i-1][j]+1,cost[i][j-1]+1,cost[i-1][j-1]+(equal(published[i-1].text,parts[j-1])?0:1));
  const identities=new Map<number,StudioWord>();let i=n,j=m;
  while(i||j){
    if(i&&j&&cost[i][j]===cost[i-1][j-1]+(equal(published[i-1].text,parts[j-1])?0:1)){
      if(equal(published[i-1].text,parts[j-1]))identities.set(j-1,published[i-1]);i--;j--;
    }else if(i&&cost[i][j]===cost[i-1][j]+1)i--;else j--;
  }
  return parts.map((text,index)=>({...identities.get(index),id:identities.get(index)?.id||'pending-sound-'+index,text,at:0,settled:true}));
}

/** Align expected word boundaries to independently decoded sounds, preserving substitutions. */
export function alignPronunciation(words: StudioWord[], heard: HeardPhone[], lexicon: Lexicon): Map<string, SpokenSound> {
  const actual: Phone[] = heard.flatMap(phone => (IPA[phone.token] || '').split(' ').filter(Boolean).map(value => ({ value, confidence: phone.confidence })));
  const result = new Map<string, SpokenSound>();
  if (!words.length || !actual.length || words.length > 110 || actual.length > 900) return result;
  const expected: { value: string; word: number; stress?: number }[] = [];
  const known: boolean[] = [];
  words.forEach((word,index) => {
    const text = normalize(word.text);
    const dictionary = lexicon[text] || (text.endsWith('in') ? lexicon[text+'g']?.replace(/NG$/, 'N') : undefined);
    known.push(Boolean(dictionary));
    const phones = dictionary ? dictionary.split(/\s+/) : Array.from({length:Math.max(2,Math.min(10,Math.round(text.length*.6)))},()=>'?');
    phones.forEach(phone=>expected.push({value:phone.replace(/[012]$/,''),word:index,stress:/[012]$/.test(phone)?Number(phone.slice(-1)):undefined}));
  });
  const n=expected.length, m=actual.length;
  const cost=Array.from({length:n+1},()=>new Float32Array(m+1));
  const move=Array.from({length:n+1},()=>new Uint8Array(m+1));
  for(let i=1;i<=n;i++){cost[i][0]=i*.9;move[i][0]=1;}
  for(let j=1;j<=m;j++){cost[0][j]=j*.85;move[0][j]=2;}
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
    const a=expected[i-1].value,b=actual[j-1].value;
    const difference=a===b?0:a==='?'?.42:VOWEL.test(a)&&VOWEL.test(b)?.56:1.1;
    const diagonal=cost[i-1][j-1]+difference, deletion=cost[i-1][j]+.9, insertion=cost[i][j-1]+.85;
    if(diagonal<=deletion&&diagonal<=insertion){cost[i][j]=diagonal;move[i][j]=0;}
    else if(deletion<=insertion){cost[i][j]=deletion;move[i][j]=1;}
    else {cost[i][j]=insertion;move[i][j]=2;}
  }
  const assignments=words.map(()=>[] as Phone[]), matches=words.map(()=>0), coverage=words.map(()=>0);
  let i=n,j=m;
  while(i||j){
    const direction=move[i][j];
    if(i&&j&&direction===0){
      const item=expected[i-1], phone=actual[j-1];
      // Keep the aligned lexical stress prior, including unstressed vowels.
      // The phone recognizer measures vowels, not performed prominence.
      assignments[item.word].unshift({...phone,stress:VOWEL.test(phone.value)&&VOWEL.test(item.value)?item.stress:undefined});coverage[item.word]++;
      if(item.value===phone.value)matches[item.word]++;
      i--;j--;
    } else if(i&&(!j||direction===1))i--;
    else {if(i)assignments[expected[i-1].word].unshift(actual[j-1]);j--;}
  }
  words.forEach((word,index)=>{
    const observed=assignments[index], expectedCount=expected.filter(phone=>phone.word===index).length;
    const vowels=observed.filter(phone=>VOWEL.test(phone.value));
    if(!vowels.length||observed.length<2||coverage[index]/expectedCount<.6)return;
    const confidence=observed.reduce((sum,phone)=>sum+phone.confidence,0)/observed.length;
    // Unknown slang needs acoustic confidence plus reliable neighboring anchors.
    const anchored=words.length===1||(index>0&&matches[index-1]>=2)||(index+1<words.length&&matches[index+1]>=2);
    const fit=known[index] ? matches[index]/Math.max(1,expectedCount-vowels.length) : anchored?1:0;
    if(confidence<.64||fit<.5||vowels.some(phone=>phone.confidence<.4))return;
    const stressSource = known[index] && vowels.every(phone=>phone.stress!==undefined) && vowels.some(phone=>(phone.stress||0)>0)
      ? 'lexicon' : !known[index] && vowels.length===1 ? 'monosyllable' : 'unknown';
    result.set(word.id,{source:'audio',confidence,stressSource,phones:observed.map(phone=>phone.value+(VOWEL.test(phone.value)?String(stressSource==='monosyllable'?1:phone.stress??0):'')).join(' ')});
  });
  return result;
}
