export type Lexicon = Record<string, string>;
import type { SpokenSound } from './pronunciation';
export type StudioWord = { id: string; text: string; at: number; settled: boolean; segment?: string; spoken?: SpokenSound; formationDelay?: number };
type Syllable = { vowel: string; coda: string[]; stress: number };
type Pronunciation = { phones: string; syllables: Syllable[] };
type Candidate = { key: string; text: string; normalized: string; words: StudioWord[]; syllables: Syllable[]; phrase: boolean };
export type RhymeFamily = { id: string; color: number; examples: string[]; wordIds: string[]; syllables: number; kind: 'rhyme' | 'multisyllable' | 'phrase' | 'near' };
export type RhymeMark = { familyId: string; color: number; near: boolean };
export type RhymeAnalysis = { families: RhymeFamily[]; marks: Record<string, RhymeMark> };
export type FamilyColors = Map<string, number>;

const FILLERS = new Set('a an the i me my you your he his she her it its we our they their in on at to of for and or but so as is was are be been with this that these those if then than from by up out not just do did does can could would should will have has had'.split(' '));
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)([012])$/;
const CONSONANT_NEIGHBORS = [new Set(['P', 'B']), new Set(['T', 'D']), new Set(['K', 'G']), new Set(['F', 'V']), new Set(['S', 'Z']), new Set(['SH', 'ZH']), new Set(['M', 'N', 'NG'])];
const VOWEL_NEIGHBORS = [new Set(['AA', 'AO']), new Set(['IH', 'IY']), new Set(['EH', 'AE']), new Set(['AH', 'UH'])];
const caches = new WeakMap<Lexicon, Map<string, Pronunciation[]>>();

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/’/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/'$/, '');
}
function parsePhones(phones: string): Syllable[] {
  const syllables: Syllable[] = [];
  for (const phone of phones.trim().split(/\s+/)) {
    const vowel = phone.match(VOWEL);
    if (vowel) syllables.push({ vowel: vowel[1], stress: Number(vowel[2]), coda: [] });
    else if (syllables.length) syllables[syllables.length - 1].coda.push(phone);
  }
  return syllables;
}
function pronunciations(word: string, lexicon: Lexicon): Pronunciation[] {
  const normalized = normalizeWord(word);
  let cache = caches.get(lexicon);
  if (!cache) { cache = new Map(); caches.set(lexicon, cache); }
  const cached = cache.get(normalized);
  if (cached) return cached;
  const phones: string[] = [];
  for (let variant = 1; variant <= 8; variant++) {
    const value = lexicon[normalized + (variant === 1 ? '' : '(' + variant + ')')];
    if (typeof value === 'string') phones.push(value);
  }
  // Explicit spoken variants only: never guess a pronunciation from spelling.
  if (normalized.endsWith('in') && !phones.length) {
    const expanded = lexicon[normalized + 'g'];
    if (typeof expanded === 'string') phones.push(expanded.replace(/NG$/, 'N'), expanded);
  }
  if (normalized.endsWith("'s") && !phones.length) {
    const base = lexicon[normalized.slice(0, -2)];
    if (typeof base === 'string') phones.push(base + ' Z');
  }
  const result = [...new Set(phones)].map(phones => ({ phones, syllables: parsePhones(phones) })).filter(value => value.syllables.length);
  cache.set(normalized, result);
  return result;
}
function signature(syllables: Syllable[]) { return syllables.map(value => value.vowel + ':' + value.coda.join('.')).join('|'); }
function tails(syllables: Syllable[]): Syllable[][] {
  const starts = syllables.flatMap((value, index) => value.stress > 0 ? [index] : []);
  if (!starts.length) starts.push(Math.max(0, syllables.length - 1));
  return starts.map(index => syllables.slice(index)).filter(value => value.length <= 5);
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
  const deletion = (phone: string, final: boolean) => final && ['T', 'D'].includes(phone) ? .35 : 1;
  const costs = Array.from({ length: a.length + 1 }, () => new Float32Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) costs[i][0] = costs[i - 1][0] + deletion(a[i - 1], i === a.length);
  for (let j = 1; j <= b.length; j++) costs[0][j] = costs[0][j - 1] + deletion(b[j - 1], j === b.length);
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const substitution = a[i - 1] === b[j - 1] ? 0 : CONSONANT_NEIGHBORS.some(group => group.has(a[i - 1]) && group.has(b[j - 1])) ? .3 : 1;
    costs[i][j] = Math.min(costs[i - 1][j] + deletion(a[i - 1], i === a.length), costs[i][j - 1] + deletion(b[j - 1], j === b.length), costs[i - 1][j - 1] + substitution);
  }
  return 1 - costs[a.length][b.length] / Math.max(1, a.length, b.length);
}
function nearSimilarity(a: Syllable[], b: Syllable[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let score = 0;
  for (let index = 0; index < a.length; index++) {
    const reduced = !a[index].stress && !b[index].stress && [a[index].vowel, b[index].vowel].every(value => ['IH', 'AH'].includes(value));
    const vowel = a[index].vowel === b[index].vowel ? 1 : reduced ? .9 : VOWEL_NEIGHBORS.some(group => group.has(a[index].vowel) && group.has(b[index].vowel)) ? .82 : 0;
    if (!vowel) return 0;
    const coda = consonantSimilarity(a[index].coda, b[index].coda);
    if (vowel < 1 && coda < .85) return 0;
    const stress = (a[index].stress > 0) === (b[index].stress > 0) ? 1 : 0;
    score += vowel * .68 + coda * .27 + stress * .05;
  }
  return score / a.length;
}

export function analyzeRhymes(words: StudioWord[], lexicon: Lexicon, includeNear = true, colorRegistry?: FamilyColors): RhymeAnalysis {
  const recent = words.slice(-320);
  const candidates: Candidate[] = [];
  const candidateKeys = new Set<string>();
  const options = recent.map(word => word.spoken?.source === 'audio' && word.spoken.confidence >= .64
    ? [{ phones: word.spoken.phones, syllables: parsePhones(word.spoken.phones) }]
    : pronunciations(word.text, lexicon));
  const add = (span: StudioWord[], syllables: Syllable[], phrase: boolean) => {
    const normalized = span.map(value => normalizeWord(value.text)).join(' ');
    const key = signature(syllables);
    const identity = key + ':' + span[0].id + ':' + span.length;
    if (candidateKeys.has(identity)) return;
    candidateKeys.add(identity);
    candidates.push({ key, text: span.map(value => value.text.replace(/[.,!?;:]$/g, '')).join(' '), normalized, words: span, syllables, phrase });
  };
  for (let index = 0; index < recent.length; index++) {
    const word = recent[index];
    if (!word.settled) continue;
    if (!FILLERS.has(normalizeWord(word.text))) for (const option of options[index]) for (const suffix of tails(option.syllables)) add([word], suffix, false);
    for (let size = 2; size <= 3 && index + size <= recent.length; size++) {
      const span = recent.slice(index, index + size);
      if (span.some((value, offset) => !value.settled || !options[index + offset].length)) continue;
      if (span.slice(0, -1).some(value => /[.,!?;:]$/.test(value.text))) continue;
      if (FILLERS.has(normalizeWord(span[0].text)) || FILLERS.has(normalizeWord(span[span.length - 1].text))) continue;
      let combinations: Pronunciation[][] = [[]];
      for (let offset = 0; offset < size; offset++) combinations = combinations.flatMap(combo => options[index + offset].slice(0, 2).map(option => [...combo, option])).slice(0, 8);
      for (const combo of combinations) {
        if (combo.filter(option => option.syllables.some(value => value.stress > 0)).length < 2) continue;
        const variants = [parsePhones(combo.map(option => option.phones).join(' ')), combo.flatMap(option => option.syllables)];
        for (const variant of variants) for (const suffix of tails(variant)) {
          if (suffix.length < 2 || suffix.length > 5 || suffix.length <= combo[combo.length - 1].syllables.length) continue;
          const start = variant.length - suffix.length;
          let first = 0; let covered = 0;
          while (first < combo.length - 1 && covered + combo[first].syllables.length <= start) covered += combo[first++].syllables.length;
          const matched = span.slice(first);
          if (matched.length < 2 || FILLERS.has(normalizeWord(matched[0].text))) continue;
          add(matched, suffix, true);
        }
      }
    }
  }
  const bySound = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = bySound.get(candidate.key) || [];
    group.push(candidate); bySound.set(candidate.key, group);
  }
  const groups = [...bySound.entries()].filter(([, values]) => new Set(values.map(value => normalizeWord(value.words[value.words.length - 1].text))).size >= 2);
  groups.sort((a, b) => b[1][0].syllables.length - a[1][0].syllables.length || Number(b[1].some(value => value.phrase)) - Number(a[1].some(value => value.phrase)));
  const families: RhymeFamily[] = [];
  const marks: Record<string, RhymeMark> = Object.create(null);
  for (const [key, values] of groups) {
    const occupied = new Set<string>();
    const usable = [...values].sort((a, b) => a.words.length - b.words.length).filter(value => {
      if (value.words.some(word => marks[word.id] || occupied.has(word.id))) return false;
      value.words.forEach(word => occupied.add(word.id));
      return true;
    });
    if (new Set(usable.map(value => normalizeWord(value.words[value.words.length - 1].text))).size < 2) continue;
    const id = 'sound:' + key;
    const color = stableColor(id, colorRegistry);
    const family: RhymeFamily = { id, color, examples: [...new Set(usable.map(value => value.text))].slice(-5), wordIds: [...new Set(usable.flatMap(value => value.words.map(word => word.id)))], syllables: usable[0].syllables.length, kind: usable.some(value => value.phrase) ? 'phrase' : usable[0].syllables.length > 1 ? 'multisyllable' : 'rhyme' };
    families.push(family);
    for (const wordId of family.wordIds) marks[wordId] = { familyId: id, color, near: false };
  }
  if (includeNear) {
    const singles = candidates.filter(value => !value.phrase);
    for (const a of singles) {
      if (marks[a.words[0].id]) continue;
      let best: Candidate | undefined;
      let bestScore = .87;
      for (const b of singles) {
        if (a.words[0].id === b.words[0].id || a.normalized === b.normalized || a.key === b.key) continue;
        const score = nearSimilarity(a.syllables, b.syllables);
        if (score > bestScore) { best = b; bestScore = score; }
      }
      if (!best) continue;
      const anchor = marks[best.words[0].id];
      const id = anchor?.familyId || 'near:' + [a.key, best.key].sort().join('~');
      const color = anchor?.color ?? stableColor(id, colorRegistry);
      let family = families.find(value => value.id === id);
      if (!family) {
        family = { id, color, examples: [best.text], wordIds: [best.words[0].id], syllables: a.syllables.length, kind: 'near' };
        families.push(family); marks[best.words[0].id] = { familyId: id, color, near: true };
      }
      if (!family.wordIds.includes(a.words[0].id)) family.wordIds.push(a.words[0].id);
      if (!family.examples.includes(a.text)) family.examples = [...family.examples, a.text].slice(-5);
      marks[a.words[0].id] = { familyId: id, color, near: true };
    }
  }
  return { families, marks };
}

/** Retain confirmed relationships when their words leave the active analysis window. */
export class RhymeSession {
  private analysis: RhymeAnalysis = { families: [], marks: {} };
  private colors = new Map<string, number>();
  private aliases = new Map<string, string>();
  private heard = new Map<string, string>();
  clear() { this.analysis = { families: [], marks: {} }; this.colors.clear(); this.aliases.clear(); this.heard.clear(); }
  update(words: StudioWord[], lexicon: Lexicon, includeNear = true): RhymeAnalysis {
    const fresh = analyzeRhymes(words, lexicon, includeNear, this.colors);
    const marks = { ...this.analysis.marks };
    // A confident acoustic correction can invalidate an earlier dictionary match.
    // Preserve the words and colors, but don't preserve a relationship we now hear differently.
    const changedFamilies = new Set<string>();
    for (const word of words) if (word.spoken && this.heard.get(word.id) !== word.spoken.phones) {
      if (marks[word.id]) changedFamilies.add(marks[word.id].familyId);
      this.heard.set(word.id, word.spoken.phones);
    }
    for (const [id, mark] of Object.entries(marks)) if (changedFamilies.has(mark.familyId)) delete marks[id];
    if (!includeNear) for (const [id, mark] of Object.entries(marks)) if (mark.near) delete marks[id];
    const metadata = new Map(this.analysis.families.map(family => [family.id, family]));
    for (const family of fresh.families) {
      const previous = family.wordIds.map(id => marks[id]).find(Boolean);
      const id = this.aliases.get(family.id) || previous?.familyId || family.id;
      this.aliases.set(family.id, id);
      const old = metadata.get(id);
      const color = old?.color ?? family.color;
      metadata.set(id, { ...family, id, color, examples: [...new Set([...(old?.examples || []), ...family.examples])].slice(-5) });
      for (const wordId of family.wordIds) {
        const oldMark = marks[wordId];
        if (!oldMark || oldMark.familyId === id || (oldMark.near && !fresh.marks[wordId].near)) marks[wordId] = { familyId: id, color, near: fresh.marks[wordId].near };
      }
    }
    const members = new Map<string, string[]>();
    for (const [wordId, mark] of Object.entries(marks)) {
      const ids = members.get(mark.familyId) || []; ids.push(wordId); members.set(mark.familyId, ids);
    }
    const families = [...members.entries()].flatMap(([id, wordIds]) => {
      const meta = metadata.get(id);
      return meta && wordIds.length >= 2 ? [{ ...meta, wordIds }] : [];
    });
    const valid = new Set(families.map(family => family.id));
    for (const [id, mark] of Object.entries(marks)) if (!valid.has(mark.familyId)) delete marks[id];
    this.analysis = { families, marks };
    return this.analysis;
  }
}
