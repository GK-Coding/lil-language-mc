/** Bounded PCM history for extracting the audio belonging to a streaming caption. */
export class StreamHistory {
  constructor(seconds = 40, rate = 16000) {
    this.limit = seconds * rate;
    this.rate = rate;
    this.frames = [];
    this.end = 0;
  }

  push(audio) {
    this.frames.push({ start: this.end, audio });
    this.end += audio.length;
    const cutoff = this.end - this.limit;
    while (this.frames.length && this.frames[0].start + this.frames[0].audio.length <= cutoff) this.frames.shift();
  }

  slice(startTime, duration, padding = .08) {
    if (!this.frames.length || !Number.isFinite(startTime) || !Number.isFinite(duration) || duration <= 0) return null;
    const start = Math.max(0, Math.floor((startTime - padding) * this.rate));
    const end = Math.min(this.end, Math.ceil((startTime + duration + padding) * this.rate));
    if (start < this.frames[0].start || end <= start) return null;
    const result = new Float32Array(end - start);
    for (const frame of this.frames) {
      const from = Math.max(start, frame.start), to = Math.min(end, frame.start + frame.audio.length);
      if (to > from) result.set(frame.audio.subarray(from - frame.start, to - frame.start), from - start);
    }
    return result;
  }
}
