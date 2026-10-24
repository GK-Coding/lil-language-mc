'use client';

import { memo, useEffect, useRef, useState } from 'react';

export default memo(function AudioWaveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [signal, setSignal] = useState('Audio off');
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const values = new Float32Array(analyser?.fftSize || 1024);
    let frame = 0;
    let previousLabel = 0;
    let displayGain = 6;
    const smoothed = new Float32Array(40);
    const draw = (now: number) => {
      if (analyser && active) analyser.getFloatTimeDomainData(values);
      else values.fill(0);
      let power = 0; let peak = 0;
      for (const value of values) { power += value * value; peak = Math.max(peak, Math.abs(value)); }
      const rms = Math.sqrt(power / values.length);
      displayGain += (Math.min(20, .8 / Math.max(.04, peak)) - displayGain) * .2;
      context.clearRect(0, 0, 320, 76);
      for (let index = 0; index < 40; index++) {
        const start = Math.floor(index * values.length / 40);
        const end = Math.floor((index + 1) * values.length / 40);
        let local = 0;
        for (let sample = start; sample < end; sample++) local = Math.max(local, Math.abs(values[sample]));
        smoothed[index] += (Math.min(1, local * displayGain) - smoothed[index]) * 0.6;
        const height = Math.max(2, smoothed[index] * 68);
        context.fillStyle = peak > .98 ? '#edc386' : rms > .006 ? '#5ce2c7' : '#777e84';
        context.fillRect(index * 8 + 1, (76 - height) / 2, 4, height);
      }
      if (now - previousLabel > 300) {
        setSignal(!analyser || !active ? 'Audio off' : peak > .98 ? 'Input too loud' : rms > .006 ? 'Audio detected' : 'Input quiet');
        previousLabel = now;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, active]);
  return <div className="studio-audio-feedback" aria-label="Live audio input"><canvas ref={canvas} width={320} height={76} aria-hidden="true" /><span>{signal}</span></div>;
});
