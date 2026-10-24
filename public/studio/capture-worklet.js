class StudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.used = 0;
    this.sum = 0;
    this.weight = 0;
    this.port.onmessage = () => {
      if (this.used) this.port.postMessage(this.buffer.slice(0, this.used));
      this.used = 0;
      this.port.postMessage({ type: 'flushed' });
    };
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    const ratio = sampleRate / 16000;
    for (let frame = 0; frame < channels[0].length; frame++) {
      let value = 0;
      for (const channel of channels) value += channel[frame] / channels.length;
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, ratio - this.weight);
        this.sum += value * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= ratio - 1e-8) {
          this.buffer[this.used++] = this.sum / ratio;
          this.sum = 0;
          this.weight = 0;
          if (this.used === this.buffer.length) {
            this.port.postMessage(this.buffer, [this.buffer.buffer]);
            this.buffer = new Float32Array(2048);
            this.used = 0;
          }
        }
      }
    }
    return true;
  }
}

registerProcessor('studio-capture', StudioCapture);
