export type SpeechWindow = { id: number; audio: Float32Array; final: boolean };

export class SpeechWindows {
  private samples: number[] = [];
  private prefix: number[] = [];
  private quiet = 0;
  private lastPreview = 0;
  private serial = 0;
  private active = false;

  push(audio: Float32Array): SpeechWindow | null {
    let power = 0;
    for (const value of audio) power += value * value;
    const voiced = Math.sqrt(power / Math.max(1, audio.length)) >= 0.008;
    if (!this.active) {
      if (!voiced) { this.prefix = [...this.prefix, ...audio].slice(-3840); return null; }
      this.active = true;
      this.serial++;
      this.samples = this.prefix;
      this.prefix = [];
    }
    for (const value of audio) this.samples.push(value);
    this.quiet = voiced ? 0 : this.quiet + audio.length;
    const final = this.quiet >= 8960 || this.samples.length >= 192000;
    if (final) {
      const result = { id: this.serial, audio: Float32Array.from(this.samples), final: true };
      this.samples = []; this.active = false; this.quiet = 0; this.lastPreview = 0;
      return result;
    }
    if (this.samples.length - this.lastPreview >= (this.lastPreview ? 8192 : 16384)) {
      this.lastPreview = this.samples.length;
      return { id: this.serial, audio: Float32Array.from(this.samples), final: false };
    }
    return null;
  }

  flush(): SpeechWindow | null {
    if (!this.active || !this.samples.length) return null;
    const value = { id: this.serial, audio: Float32Array.from(this.samples), final: true };
    this.samples = []; this.active = false; this.quiet = 0; this.lastPreview = 0;
    return value;
  }
}

/** Final utterances are retained; obsolete previews of the same utterance are replaced. */
export class SpeechQueue {
  private pending: SpeechWindow[] = [];

  push(value: SpeechWindow) {
    this.pending = this.pending.filter(item => item.id !== value.id);
    this.pending.push(value);
    if (this.pending.filter(item => item.final).length > 4) {
      throw new Error('This device cannot keep up with live transcription. Choose Fast mode or pause other apps, then try again.');
    }
  }

  shift() { return this.pending.shift(); }
}
