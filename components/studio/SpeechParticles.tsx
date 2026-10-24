'use client';

import { memo, RefObject, useEffect, useRef } from 'react';

type Dot = { x: number; y: number; seed: number };
type Formation = { element: HTMLElement; dots: Dot[]; started: number; from: { x: number; y: number }; color: string };
const noise = (seed: number) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };

/** Actual input energy moves the frontier; new committed DOM words supply glyph targets. */
export default memo(function SpeechParticles({ analyser, active, busy, pending, following, wordRoot, viewport }: {
  analyser: AnalyserNode | null; active: boolean; busy: boolean; pending: number; following: boolean;
  wordRoot: RefObject<HTMLDivElement>; viewport: RefObject<HTMLDivElement>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, busy, pending, following });
  state.current = { active, busy, pending, following };

  useEffect(() => {
    const surface = canvas.current;
    const root = wordRoot.current;
    const view = viewport.current;
    const context = surface?.getContext('2d');
    if (!surface || !root || !view || !context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const values = new Float32Array(analyser?.fftSize || 1024);
    const seen = new Set<string>();
    const glyphCache = new Map<string, Dot[]>();
    let formations: Formation[] = [];
    let width = 0; let height = 0; let frame = 0; let lastPaint = 0; let lastVoice = -10000; let level = 0; let cloudOpacity = 0;
    let frontier = { x: 80, y: 200 };
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      width = rect.width; height = rect.height;
      const density = Math.min(2, window.devicePixelRatio || 1);
      surface.width = Math.round(width * density); surface.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface); resize();
    const glyphs = (element: HTMLElement): Dot[] => {
      const text = element.querySelector('.studio-word-text')?.textContent || '';
      const style = getComputedStyle(element);
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const key = text + ':' + font;
      const cached = glyphCache.get(key);
      if (cached) return cached;
      const glyph = document.createElement('canvas');
      const rect = element.getBoundingClientRect();
      glyph.width = Math.ceil(rect.width); glyph.height = Math.ceil(rect.height);
      const ink = glyph.getContext('2d', { willReadFrequently: true });
      if (!ink || !glyph.width || !glyph.height) return [];
      ink.font = font; ink.textBaseline = 'middle'; ink.fillStyle = '#fff';
      ink.fillText(text, 2, glyph.height * .5);
      const pixels = ink.getImageData(0, 0, glyph.width, glyph.height).data;
      const dots: Dot[] = [];
      const step = Math.max(3, Math.round(parseFloat(style.fontSize) / 11));
      for (let y = 1; y < glyph.height; y += step) for (let x = 1; x < glyph.width; x += step) {
        if (pixels[(y * glyph.width + x) * 4 + 3] > 100) dots.push({ x, y, seed: x * 13 + y * 7 });
      }
      // Keep a burst bounded even when a whole final sentence arrives together.
      const sampled = dots.filter((_, index) => index % Math.max(1, Math.ceil(dots.length / 90)) === 0);
      glyphCache.set(key, sampled);
      return sampled;
    };
    const collect = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>('.studio-word'));
      if (!elements.length) { seen.clear(); formations = []; return; }
      for (const element of elements) {
        const id = element.dataset.wordId!;
        if (seen.has(id)) continue;
        seen.add(id);
        if (!state.current.following || reduced.matches) continue;
        formations.push({ element, dots: glyphs(element), started: performance.now(), from: { ...frontier }, color: getComputedStyle(element).getPropertyValue('--rhyme-color').trim() || '#5ce2c7' });
      }
      formations = formations.slice(-24);
    };
    // Existing words are history on analyser changes; only newly mounted words form.
    root.querySelectorAll<HTMLElement>('.studio-word').forEach(element => seen.add(element.dataset.wordId!));
    const observer = new MutationObserver(collect); observer.observe(root, { childList: true, subtree: true });
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - lastPaint < 1000 / 30) return;
      lastPaint = now;
      context.clearRect(0, 0, width, height);
      if (reduced.matches || !state.current.following) return;
      if (analyser && state.current.active) analyser.getFloatTimeDomainData(values); else values.fill(0);
      let power = 0;
      for (const value of values) power += value * value;
      const rms = Math.sqrt(power / values.length);
      level += (Math.min(1, rms * 16) - level) * .45;
      if (rms > .004) lastVoice = now;
      const viewRect = surface.getBoundingClientRect();
      const latest = root.querySelector<HTMLElement>('.studio-line:last-child .studio-word:last-child');
      const last = latest?.getBoundingClientRect();
      if (last) {
        frontier = { x: last.right - viewRect.left + 72, y: last.top - viewRect.top + last.height * .5 };
        if (frontier.x > width - 90) frontier = { x: 80, y: last.bottom - viewRect.top + 30 };
      } else frontier = { x: Math.min(130, width * .4), y: height - 160 };
      frontier.y = Math.min(height - 35, Math.max(30, frontier.y));
      const waiting = state.current.active && (now - lastVoice < 420 || state.current.busy || state.current.pending > 0);
      cloudOpacity += ((waiting ? .7 : 0) - cloudOpacity) * .18;
      if (cloudOpacity > .01) for (let index = 0; index < 130; index++) {
        const seed = index + 1;
        const band = Math.abs(values[Math.floor(index * values.length / 130)] || 0);
        const spread = 1 + level * .5;
        const x = frontier.x + (noise(seed) - .5) * 135 * spread + Math.sin(now * .012 + seed) * (1 + level * 13 + band * 20);
        const y = frontier.y + (noise(seed + 900) - .5) * 34 * spread + Math.cos(now * .014 + seed * 2) * (1 + level * 11);
        context.globalAlpha = cloudOpacity * (.25 + noise(seed + 50) * .75);
        context.fillStyle = index % 4 ? '#5ce2c7' : '#d0b7f4';
        context.beginPath(); context.arc(x, y, .7 + noise(seed + 10) * 1.1, 0, Math.PI * 2); context.fill();
      }
      formations = formations.filter(batch => now - batch.started < 540 && batch.element.isConnected);
      for (const batch of formations) {
        const rect = batch.element.getBoundingClientRect();
        const age = Math.min(1, (now - batch.started) / 460);
        const ease = 1 - Math.pow(1 - age, 3);
        for (const dot of batch.dots) {
          const fromX = batch.from.x + (noise(dot.seed) - .5) * 140;
          const fromY = batch.from.y + (noise(dot.seed + 2) - .5) * 48;
          const targetX = rect.left - viewRect.left + dot.x;
          const targetY = rect.top - viewRect.top + dot.y;
          const x = fromX + (targetX - fromX) * ease;
          const y = fromY + (targetY - fromY) * ease + Math.sin(now * .025 + dot.seed) * level * 8 * (1 - ease);
          context.globalAlpha = Math.max(0, 1 - Math.pow(age, 3)) * .85;
          context.fillStyle = batch.color === 'transparent' ? '#5ce2c7' : batch.color;
          context.fillRect(x, y, 1.7, 1.7);
        }
      }
      context.globalAlpha = 1;
      surface.dataset.audioLevel = level.toFixed(3);
      surface.dataset.formingWords = String(formations.length);
      surface.dataset.frontierVisible = String(cloudOpacity > .05);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect(); context.clearRect(0, 0, width, height); };
  }, [analyser, viewport, wordRoot]);

  return <canvas ref={canvas} className="studio-speech-particles" data-testid="speech-particles" aria-hidden="true" />;
});
