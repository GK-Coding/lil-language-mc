import type { StudioWord } from './rhyme-engine';

type TrackedWord = StudioWord & { confirmations: number };
type Segment = { id: string; words: TrackedWord[] };
const normalized = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '');

// Keep identities through insertions, deletions, punctuation changes and corrections.
function align(previous: TrackedWord[], parts: string[]) {
  const scores = Array.from({ length: previous.length + 1 }, () => new Uint16Array(parts.length + 1));
  for (let i = 0; i <= previous.length; i++) scores[i][0] = i;
  for (let j = 0; j <= parts.length; j++) scores[0][j] = j;
  for (let i = 1; i <= previous.length; i++) for (let j = 1; j <= parts.length; j++) {
    scores[i][j] = Math.min(scores[i - 1][j] + 1, scores[i][j - 1] + 1, scores[i - 1][j - 1] + (normalized(previous[i - 1].text) === normalized(parts[j - 1]) ? 0 : 1));
  }
  const matches = new Map<number, TrackedWord>();
  let i = previous.length; let j = parts.length;
  while (i || j) {
    const cost = i && j && normalized(previous[i - 1].text) === normalized(parts[j - 1]) ? 0 : 1;
    if (i && j && scores[i][j] === scores[i - 1][j - 1] + cost) { matches.set(j - 1, previous[i - 1]); i--; j--; }
    else if (i && scores[i][j] === scores[i - 1][j] + 1) i--;
    else j--;
  }
  return matches;
}

export class TranscriptTrail {
  private segments: Segment[] = [];
  private counter = 0;

  clear(): StudioWord[] {
    this.segments = [];
    this.counter = 0;
    return [];
  }

  update(id: string, text: string, final: boolean, at: number): StudioWord[] {
    let segment = this.segments.find(value => value.id === id);
    if (!segment) { segment = { id, words: [] }; this.segments.push(segment); }
    let parts: string[] = text.trim().match(/\S+/g) || [];
    // Once repeated hypotheses agree on a prefix, keep it on screen. A later
    // compressed final hypothesis must not erase already confirmed speech.
    let committed = 0;
    while (committed < segment.words.length && segment.words[committed].settled) committed++;
    if (committed && parts.length) {
      const anchors = align(segment.words, parts);
      let lastAnchor = -1;
      for (const [index, previous] of anchors) {
        if (segment.words.indexOf(previous) < committed && normalized(previous.text) === normalized(parts[index])) lastAnchor = Math.max(lastAnchor, index);
      }
      if (lastAnchor >= 0) parts = [...segment.words.slice(0, committed).map(word => word.text), ...parts.slice(lastAnchor + 1)];
    }
    const matches = align(segment.words, parts);
    segment.words = parts.map((part, index) => {
      const previous = matches.get(index);
      const same = Boolean(previous && normalized(previous.text) === normalized(part));
      const confirmations = same ? previous!.confirmations + 1 : 1;
      const appears = previous ? previous.at : at;
      return { id: previous?.id || 'word-' + this.counter++, segment: id, text: part, at: appears, confirmations, settled: final || (confirmations >= 2 && index < parts.length - 2) };
    });
    return this.segments.flatMap(value => value.words);
  }
}

export type TranscriptRow = { id: string; words: StudioWord[] };

export function transcriptRows(words: StudioWord[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  const rowCounts = new Map<string, number>();
  let buffer: StudioWord[] = [];
  const flush = () => {
    if (!buffer.length) return;
    const segment = buffer[0].segment;
    const number = segment ? rowCounts.get(segment) || 0 : 0;
    rows.push({ id: segment ? segment + ':row-' + number : buffer[0].id, words: buffer });
    if (segment) rowCounts.set(segment, number + 1);
    buffer = [];
  };
  for (const word of words) {
    if (buffer.length && word.segment && word.segment !== buffer[0].segment) flush();
    buffer.push(word);
    if (buffer.length >= 12 || (buffer.length >= 3 && /[.!?]$/.test(word.text))) flush();
  }
  flush();
  return rows;
}

/** Tentative hypotheses stay in the particle frontier; published words never retract. */
export class StableTranscript {
  private words: StudioWord[] = [];
  private published = new Set<string>();
  clear() { this.words = []; this.published.clear(); }
  update(snapshot: StudioWord[], at: number, scripted = false) {
    let arriving = 0;
    const blockedSegments = new Set<string>();
    for (const word of snapshot) {
      if (this.published.has(word.id)) continue;
      const segment = word.segment || 'default';
      if (blockedSegments.has(segment)) continue;
      if (!word.settled && !scripted) { blockedSegments.add(segment); continue; }
      this.published.add(word.id);
      this.words.push({ ...word, at, settled: true, formationDelay: Math.min(360, arriving++ * 32) });
    }
    const preview = snapshot.filter(word => word.segment === snapshot[snapshot.length - 1]?.segment && !this.published.has(word.id)).slice(0,12);
    return { words: this.words.slice(), pending: preview.length, preview };
  }
}
