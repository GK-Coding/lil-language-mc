export type Lexicon = Record<string, string>;

export type StudioWord = {
  id: string;
  text: string;
  at: number;
  settled: boolean;
};

type Syllable = { vowel: string; coda: string[]; stress: number };
type Candidate = {
  key: string;
  text: string;
  normalized: string;
  words: StudioWord[];
  syllables: Syllable[];
  phrase: boolean;
};

export type RhymeFamily = {
  id: string;
  color: number;
  examples: string[];
  wordIds: string[];
  syllables: number;
  kind: 'rhyme' | 'multisyllable' | 'phrase' | 'near';
};

export type RhymeMark = { familyId: string; color: number; near: boolean };
export type RhymeAnalysis = { families: RhymeFamily[]; marks: Record<string, RhymeMark> };
export type FamilyColors = Map<string, number>;

const FILLERS = new Set('a an the i me my you your he his she her it its we our they their in on at to of for and or but so as is was are be been with this that these those if then than from by up out not just do did does can could would should will have has had'.split(' '));
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)([012])$/;
const CONSONANT_NEIGHBORS = [new Set(['P', 'B']), new Set(['T', 'D']), new Set(['K', 'G']), new Set(['F', 'V']), new Set(['S', 'Z']), new Set(['SH', 'ZH']), new Set(['M', 'N', 'NG'])];

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/'$/, '');
}

function parsePhones(phones: string): Syllable[] {
  const syllables: Syllable[] = [];
  for (const phone of phones.split(' ')) {
    const vowel = phone.match(VOWEL);
    if (vowel) syllables.push({ vowel: vowel[1], stress: Number(vowel[2]), coda: [] });
    else if (syllables.length) syllables[syllables.length - 1].coda.push(phone);
  }
  return syllables;
}

function pronunciations(word: string, lexicon: Lexicon): Syllable[][] {
  const normalized = normalizeWord(word);
  if (!normalized) return [];
  const found: Syllable[][] = [];
  for (const key of [normalized, normalized + '(2)', normalized + '(3)']) {
    if (typeof lexicon[key] === 'string') found.push(parsePhones(lexicon[key]));
  }
  // A common rap contraction. Keep the spoken final N rather than the dictionary NG.
  if (!found.length && normalized.endsWith('in')) {
    const expanded = lexicon[normalized + 'g'];
    if (typeof expanded === 'string') found.push(parsePhones(expanded.replace(/NG$/, 'N')));
  }
  return found.filter(value => value.length > 0);
}

function signature(syllables: Syllable[]): string {
  return syllables.map(value => value.vowel + ':' + value.coda.join('.')).join('|');
}

function tail(syllables: Syllable[]): Syllable[] {
  let start = syllables.map(value => value.stress).lastIndexOf(1);
  if (start < 0) start = Math.max(0, syllables.length - 1);
  return syllables.slice(start);
}

function stableColor(key: string, registry?: FamilyColors): number {
  if (registry) {
    const known = registry.get(key);
    if (known !== undefined) return known;
    const color = registry.size % 12;
    registry.set(key, color);
    return color;
  }
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = ((hash << 5) - hash + key.charCodeAt(index)) | 0;
  return Math.abs(hash) % 12;
}

function consonantSimilarity(a: string[], b: string[]): number {
  if (a.join() === b.join()) return 1;
  const length = Math.max(a.length, b.length);
  if (!length) return 1;
  let score = 0;
  for (let index = 0; index < length; index++) {
    if (a[index] && a[index] === b[index]) score += 1;
    else if (a[index] && b[index] && CONSONANT_NEIGHBORS.some(group => group.has(a[index]) && group.has(b[index]))) score += 0.7;
  }
  return score / length;
}

function nearSimilarity(a: Syllable[], b: Syllable[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let score = 0;
  for (let index = 0; index < a.length; index++) {
    if (a[index].vowel !== b[index].vowel) return 0;
    const stress = (a[index].stress > 0) === (b[index].stress > 0) ? 1 : 0;
    score += 0.65 + consonantSimilarity(a[index].coda, b[index].coda) * 0.3 + stress * 0.05;
  }
  return score / a.length;
}

export function analyzeRhymes(words: StudioWord[], lexicon: Lexicon, includeNear = true, colorRegistry?: FamilyColors): RhymeAnalysis {
  const recent = words.slice(-160);
  const candidates: Candidate[] = [];
  const options = recent.map(word => pronunciations(word.text, lexicon));

  for (let index = 0; index < recent.length; index++) {
    const word = recent[index];
    const normalized = normalizeWord(word.text);
    if (!word.settled || FILLERS.has(normalized)) continue;
    for (const option of options[index]) {
      const syllables = tail(option);
      candidates.push({ key: signature(syllables), text: word.text.replace(/[.,!?;:]$/g, ''), normalized, words: [word], syllables, phrase: false });
    }
    // Phrase matching crosses word boundaries, but never an unrecognized word or a sentence boundary.
    for (let size = 2; size <= 3 && index + size <= recent.length; size++) {
      const span = recent.slice(index, index + size);
      if (span.some((value, offset) => !value.settled || !options[index + offset].length)) continue;
      if (span.slice(0, -1).some(value => /[.,!?;:]$/.test(value.text))) continue;
      if (FILLERS.has(normalizeWord(span[span.length - 1].text))) continue;
      const syllables = span.flatMap((value, offset) => options[index + offset][0]);
      if (syllables.length < 2 || syllables.length > 4 || syllables.filter(value => value.stress > 0).length < 2) continue;
      const phrase = span.map(value => normalizeWord(value.text)).join(' ');
      candidates.push({ key: 'phrase:' + signature(syllables), text: span.map(value => value.text.replace(/[.,!?;:]$/g, '')).join(' '), normalized: phrase, words: span, syllables, phrase: true });
    }
  }

  const bySound = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = bySound.get(candidate.key) || [];
    if (!group.some(value => value.normalized === candidate.normalized && value.words[0].id === candidate.words[0].id)) group.push(candidate);
    bySound.set(candidate.key, group);
  }
  const groups = Array.from(bySound.entries()).filter(([, values]) => new Set(values.map(value => value.normalized)).size >= 2);
  groups.sort((a, b) => b[1][0].syllables.length - a[1][0].syllables.length || Number(b[1][0].phrase) - Number(a[1][0].phrase));

  const families: RhymeFamily[] = [];
  const marks: Record<string, RhymeMark> = Object.create(null);
  for (const [key, values] of groups) {
    const usable = values.filter(value => value.words.every(word => !marks[word.id]));
    if (new Set(usable.map(value => value.normalized)).size < 2) continue;
    const first = usable[0];
    const id = 'sound:' + key;
    const color = stableColor(id, colorRegistry);
    const family: RhymeFamily = {
      id, color,
      examples: Array.from(new Set(usable.map(value => value.text))).slice(-5),
      wordIds: usable.flatMap(value => value.words.map(word => word.id)),
      syllables: first.syllables.length,
      kind: first.phrase ? 'phrase' : first.syllables.length > 1 ? 'multisyllable' : 'rhyme'
    };
    families.push(family);
    for (const wordId of family.wordIds) marks[wordId] = { familyId: id, color, near: false };
  }

  if (includeNear) {
    const unmarked = candidates.filter(value => !value.phrase && value.words.every(word => !marks[word.id]));
    for (let index = 0; index < unmarked.length; index++) {
      const a = unmarked[index];
      if (marks[a.words[0].id]) continue;
      let best: Candidate | undefined;
      let bestScore = 0.84;
      for (let other = index + 1; other < unmarked.length; other++) {
        const b = unmarked[other];
        if (a.normalized === b.normalized || a.key === b.key || marks[b.words[0].id]) continue;
        const score = nearSimilarity(a.syllables, b.syllables);
        if (score > bestScore) { best = b; bestScore = score; }
      }
      if (!best) continue;
      const id = 'near:' + [a.key, best.key].sort().join('~');
      const color = stableColor(id, colorRegistry);
      const family: RhymeFamily = { id, color, examples: [a.text, best.text], wordIds: [a.words[0].id, best.words[0].id], syllables: a.syllables.length, kind: 'near' };
      families.push(family);
      for (const wordId of family.wordIds) marks[wordId] = { familyId: id, color, near: true };
    }
  }
  return { families, marks };
}
