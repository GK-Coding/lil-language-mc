/** A small original instrumental, used only by the labeled motion demo. */
export class StudioBeat {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private tempo = 92;
  private volume = 0.45;

  get time() { return this.context?.currentTime || 0; }

  async start(tempo: number) {
    if (this.context) { this.tempo = tempo; await this.context.resume(); return; }
    const context = new AudioContext();
    this.context = context;
    this.tempo = tempo;
    this.gain = context.createGain();
    this.gain.gain.value = this.volume * 0.27;
    this.gain.connect(context.destination);
    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    this.next = context.currentTime + 0.06;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    await context.resume();
  }

  private tone(frequency: number, at: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (!this.context || !this.gain) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(envelope).connect(this.gain);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private percussion(at: number, snare: boolean) {
    if (!this.context || !this.gain || !this.noise) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = snare ? 1000 : 6500;
    envelope.gain.setValueAtTime(snare ? 0.45 : 0.11, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + (snare ? 0.16 : 0.035));
    source.connect(filter).connect(envelope).connect(this.gain);
    source.start(at);
    source.stop(at + 0.2);
    if (snare) this.tone(175, at, 0.075, 0.25, 'triangle');
  }

  private schedule() {
    if (!this.context || !this.gain || this.context.state !== 'running') return;
    while (this.next < this.context.currentTime + 0.12) {
      const step = this.step % 8;
      const bar = Math.floor(this.step / 8);
      const at = this.next;
      this.percussion(at + (step % 2 ? 0.014 : 0), false);
      if (step === 2 || step === 6) this.percussion(at, true);
      if (step === 0 || step === 4 || (step === 7 && bar % 2)) {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        oscillator.frequency.setValueAtTime(135, at);
        oscillator.frequency.exponentialRampToValueAtTime(43, at + 0.14);
        envelope.gain.setValueAtTime(1.3, at);
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
        oscillator.connect(envelope).connect(this.gain);
        oscillator.start(at); oscillator.stop(at + 0.3);
      }
      if (step === 0 || step === 3 || step === 5) {
        const root = [55, 43.65, 65.406, 49][bar % 4];
        this.tone(root * (step === 5 ? 2 : 1), at, 0.28, 0.62, 'triangle');
      }
      if (step === 0) {
        const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
        chords[bar % 4].forEach((frequency, index) => this.tone(frequency, at + index * 0.024, 1.1, 0.095, 'triangle'));
      }
      this.next += 30 / this.tempo;
      this.step++;
    }
  }

  setTempo(value: number) { this.tempo = value; }
  setVolume(value: number) {
    this.volume = value;
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(value * 0.27, this.context.currentTime, 0.04);
  }
  async pause() { await this.context?.suspend(); }
  async close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
