import type { StudioWord } from './rhyme-engine';

type Segment = { id: string; words: StudioWord[] };

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
    const parts = text.trim().match(/\S+/g) || [];
    let prefix = 0;
    while (prefix < parts.length && segment.words[prefix]?.text === parts[prefix]) prefix++;
    segment.words = parts.map((part, index) => ({
      id: index < prefix ? segment!.words[index].id : 'word-' + this.counter++,
      text: part,
      at: index < prefix ? segment!.words[index].at : at + Math.max(0, index - prefix) * 0.035,
      settled: final || index < parts.length - 2
    }));
    if (this.segments.length > 100) this.segments = this.segments.slice(-100);
    return this.segments.flatMap(value => value.words).slice(-1600);
  }
}

export type TranscriptRow = { id: string; words: StudioWord[] };

export function transcriptRows(words: StudioWord[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  let buffer: StudioWord[] = [];
  for (const word of words) {
    buffer.push(word);
    if (buffer.length >= 12 || (buffer.length >= 3 && /[.!?]$/.test(word.text))) {
      rows.push({ id: buffer[0].id, words: buffer });
      buffer = [];
    }
  }
  if (buffer.length) rows.push({ id: buffer[0].id, words: buffer });
  return rows;
}
