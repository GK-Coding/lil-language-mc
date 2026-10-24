/** Reuse sounds already heard; overlap new audio so a syllable isn't cut at a model boundary. */
export class PhoneWindows {
  id = null;
  samples = 0;
  phones = [];

  plan(id, length) {
    if (id !== this.id || length < this.samples) { this.id = id; this.samples = 0; this.phones = []; }
    const windows = [];
    let start = Math.max(0, this.samples - 6400);
    while (start < length) {
      const end = Math.min(length, start + 48000);
      windows.push({ start, end, seam: start ? (start + 3200) / 16000 : 0 });
      if (end === length) break;
      start = end - 6400;
    }
    return windows;
  }

  append(phones, window) {
    const center = phone => (phone.start + phone.end) / 2;
    const combined = [...this.phones.filter(phone => center(phone) < window.seam), ...phones.filter(phone => center(phone) >= window.seam)];
    const merged = [];
    for (const phone of combined) {
      const last = merged[merged.length - 1];
      if (last && last.token === phone.token && phone.start - last.end < .04) {
        last.end = Math.max(last.end, phone.end); last.confidence = Math.max(last.confidence, phone.confidence);
      } else merged.push({ ...phone });
    }
    this.samples = window.end; this.phones = merged;
    return this.phones;
  }
}
