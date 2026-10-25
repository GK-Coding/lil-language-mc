'use client';

import { memo, RefObject, useLayoutEffect, useRef } from 'react';
import { clampUnit, particleFlight, particleFormation, particleNoise, ParticlePoint, reservoirPoint } from '@/lib/studio/particle-flow';

type Grain = ParticlePoint & { seed: number; mode: 'cloud' | 'seeking' | 'word' | 'return'; started: number; from: ParticlePoint };
type Shape = { dots: ParticlePoint[]; width: number };
type Formation = {
  element: HTMLElement; text: string; shape: Shape; particles: Grain[]; origins: ParticlePoint[];
  started: number; confirmed: number | null; gathered: number; landing: boolean;
};
const POOL_SIZE = 2800;

/** One persistent voice cloud lends its own particles to tentative and confirmed words. */
export default memo(function SpeechParticles({ analyser, active, busy, pending, following, wordRoot, viewport }: {
  analyser: AnalyserNode | null; active: boolean; busy: boolean; pending: number; following: boolean;
  wordRoot: RefObject<HTMLDivElement>; viewport: RefObject<HTMLDivElement>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ analyser, active, busy, pending, following });
  state.current = { analyser, active, busy, pending, following };

  useLayoutEffect(() => {
    const surface = canvas.current, root = wordRoot.current, view = viewport.current;
    const context = surface?.getContext('2d');
    if (!surface || !root || !view || !context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new Set<string>();
    const formations = new Map<string, Formation>();
    const glyphCache = new Map<string, Shape>();
    const pool: Grain[] = Array.from({ length: POOL_SIZE }, (_, index) => ({
      seed: index + 1, x: 0, y: 0, mode: 'cloud', started: -1000, from: { x: 0, y: 0 }
    }));
    let width = 0, height = 0, frame = 0, lastPaint = 0, lastVoice = -10000, level = 0, envelope = 0;
    let values = new Float32Array(1024), frequencies = new Uint8Array(512);
    let center = { x: 0, y: 0 }, frontier = { x: 25, y: 150 }, reviewing = false;
    let launchBudget = 0, cloudOpacity = .3;

    const settle = (element: HTMLElement) => {
      element.dataset.particleState = 'settled'; element.style.removeProperty('--particle-ink');
    };
    const release = (particle: Grain, now: number, returning = false) => {
      particle.mode = returning ? 'return' : 'cloud'; particle.started = now;
      particle.from = { x: particle.x, y: particle.y };
    };
    const glyphs = (element: HTMLElement): Shape => {
      const label = element.querySelector<HTMLElement>('.studio-word-text');
      const text = label?.textContent || '';
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      const textRect = label?.getBoundingClientRect() || rect;
      const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const key = [text, font, style.letterSpacing, textRect.width.toFixed(1), textRect.height.toFixed(1)].join(':');
      const cached = glyphCache.get(key); if (cached) return cached;
      const glyph = document.createElement('canvas');
      glyph.width = Math.ceil(textRect.width) + 4; glyph.height = Math.ceil(textRect.height) + 4;
      const ink = glyph.getContext('2d', { willReadFrequently: true });
      if (!ink || !glyph.width || !glyph.height) return { dots: [], width: rect.width };
      ink.font = font; ink.textBaseline = 'alphabetic'; ink.fillStyle = '#fff';
      const metrics = ink.measureText(text);
      const baseline = 2 + (metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * .85);
      // DOM character positions retain the actual font's tracking and kerning.
      const node = label?.firstChild;
      if (node?.nodeType === Node.TEXT_NODE) {
        const range = document.createRange(); let offset = 0;
        for (const character of Array.from(text)) {
          range.setStart(node, offset); offset += character.length; range.setEnd(node, offset);
          ink.fillText(character, 2 + range.getBoundingClientRect().left - textRect.left, baseline);
        }
      } else ink.fillText(text, 2, baseline);
      const pixels = ink.getImageData(0, 0, glyph.width, glyph.height).data;
      const dots: ParticlePoint[] = [], step = parseFloat(style.fontSize) >= 38 ? 2 : 1.6;
      for (let y = 1; y < glyph.height; y += step) for (let x = 1; x < glyph.width; x += step) {
        if (pixels[(Math.floor(y) * glyph.width + Math.floor(x)) * 4 + 3] > 90) {
          dots.push({ x: x - 2 + textRect.left - rect.left, y: y - 2 + textRect.top - rect.top });
        }
      }
      const shape = { dots, width: rect.width };
      if (glyphCache.size > 160) glyphCache.clear(); glyphCache.set(key, shape); return shape;
    };
    const resize = () => {
      const rect = surface.getBoundingClientRect(); width = rect.width; height = rect.height;
      const density = Math.min(2, window.devicePixelRatio || 1);
      surface.width = Math.round(width * density); surface.height = Math.round(height * density);
      context.setTransform(density, 0, 0, density, 0, 0);
      center = { x: width / 2, y: Math.max(28, height - 43) };
      glyphCache.clear(); formations.forEach(batch => { batch.shape = glyphs(batch.element); });
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface); resize();

    const collect = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>('.studio-word'));
      const now = performance.now();
      if (!elements.length) {
        seen.clear(); formations.clear(); pool.forEach(particle => release(particle, now)); return;
      }
      const fresh: HTMLElement[] = [];
      for (const element of elements.slice(-48)) {
        const id = element.dataset.wordId!;
        const text = element.querySelector('.studio-word-text')?.textContent || '';
        const dust = element.dataset.wordPhase === 'dust', known = formations.get(id);
        if (known) {
          known.element = element;
          if (known.text !== text) { known.text = text; known.shape = glyphs(element); }
          if (!dust && known.confirmed === null) {
            known.gathered = particleFormation(now, known.started, null).travel; known.confirmed = now;
          }
          element.dataset.particleState = known.landing ? 'landing' : 'forming'; continue;
        }
        if (seen.has(id)) { settle(element); continue; }
        seen.add(id);
        if (!state.current.following || reduced.matches) { settle(element); continue; }
        fresh.push(element);
      }
      // In-flight voice grains get first choice of a real word's destination.
      const available = [...pool.filter(p => p.mode === 'seeking'), ...pool.filter(p => p.mode === 'cloud')];
      const perWord = Math.min(240, Math.max(24, Math.floor((available.length - 420) / Math.max(1, fresh.length))));
      let cursor = 0;
      fresh.forEach((element, index) => {
        const shape = glyphs(element), count = Math.min(shape.dots.length, perWord, available.length - cursor);
        if (count < 8) { settle(element); return; }
        const particles = available.slice(cursor, cursor + count); cursor += count;
        const delay = element.dataset.wordPhase === 'dust' ? index * 28 : parseFloat(element.style.getPropertyValue('--formation-delay')) || 0;
        const started = now + delay;
        particles.forEach(particle => { particle.mode = 'word'; });
        formations.set(element.dataset.wordId!, {
          element, text: element.querySelector('.studio-word-text')?.textContent || '', shape, particles,
          origins: particles.map(({ x, y }) => ({ x, y })), started,
          confirmed: element.dataset.wordPhase === 'dust' ? null : started, gathered: 0, landing: false
        });
        element.dataset.particleState = 'forming'; element.style.setProperty('--particle-ink', '0');
      });
    };
    root.querySelectorAll<HTMLElement>('.studio-word').forEach(element => { seen.add(element.dataset.wordId!); settle(element); });
    const observer = new MutationObserver(collect);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-word-phase'] });
    const refreshFonts = () => { glyphCache.clear(); formations.forEach(batch => { batch.shape = glyphs(batch.element); }); };
    document.fonts.addEventListener('loadingdone', refreshFonts);
    const paint = (particle: Grain, alpha: number, color: string, size = 1) => {
      context.globalAlpha = alpha; context.fillStyle = color; context.fillRect(particle.x, particle.y, size, size);
    };
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw); if (now - lastPaint < 1000 / 30) return;
      const dt = Math.min(.08, (now - lastPaint) / 1000 || 1 / 30); lastPaint = now;
      context.clearRect(0, 0, width, height);
      const current = state.current;
      if (reduced.matches || !current.following) {
        if (!reviewing) {
          formations.forEach(batch => settle(batch.element)); formations.clear();
          pool.forEach(particle => release(particle, now)); reviewing = true;
        }
        surface.dataset.motion = reduced.matches ? 'reduced' : 'reviewing';
        surface.dataset.formingWords = '0'; surface.dataset.frontierVisible = 'false'; return;
      }
      reviewing = false;
      const audio = current.analyser;
      if (audio && current.active) {
        if (values.length !== audio.fftSize) values = new Float32Array(audio.fftSize);
        if (frequencies.length !== audio.frequencyBinCount) frequencies = new Uint8Array(audio.frequencyBinCount);
        audio.getFloatTimeDomainData(values); audio.getByteFrequencyData(frequencies);
      } else { values.fill(0); frequencies.fill(0); }
      let power = 0; for (const value of values) power += value * value;
      const rms = Math.sqrt(power / values.length), targetLevel = Math.min(1, rms * 16);
      level += (targetLevel - level) * (1 - Math.exp(-dt / (targetLevel > level ? .045 : .23)));
      envelope = Math.max(level, envelope * Math.exp(-dt / .8)); if (rms > .004) lastVoice = now;
      const recent = now - lastVoice < 850;
      const waiting = current.active && (recent || current.pending > 0 || (current.busy && now - lastVoice < 5000));
      cloudOpacity += ((current.active ? .9 : .3) - cloudOpacity) * .1;
      const bounds = surface.getBoundingClientRect();
      const dust = root.querySelector<HTMLElement>('.studio-word[data-word-phase="dust"]');
      const words = root.querySelectorAll<HTMLElement>('.studio-word[data-word-phase="ink"]');
      const latest = words[words.length - 1]?.getBoundingClientRect();
      if (dust) {
        const rect = dust.getBoundingClientRect(); frontier = { x: rect.left - bounds.left + Math.min(45, rect.width / 2), y: rect.top - bounds.top + rect.height / 2 };
      } else if (latest) {
        frontier = { x: latest.right - bounds.left + 45, y: latest.top - bounds.top + latest.height / 2 };
        if (frontier.x > width - 70) frontier = { x: 30, y: latest.bottom - bounds.top + 22 };
      } else frontier = { x: Math.min(75, width * .2), y: height - 127 };
      frontier.y = Math.max(26, Math.min(height - 82, frontier.y));

      let seeking = pool.reduce((count, particle) => count + Number(particle.mode === 'seeking'), 0);
      launchBudget = waiting ? Math.min(8, launchBudget + dt * (30 + envelope * 125)) : 0;
      for (const particle of pool) {
        const band = frequencies[Math.floor(particleNoise(particle.seed + 10) * Math.min(160, frequencies.length))] / 255 || 0;
        const home = reservoirPoint(particle.seed, now, center, width, level * (.6 + band * .7));
        if (particle.mode === 'cloud') {
          particle.x = home.x; particle.y = home.y;
          paint(particle, cloudOpacity * (.18 + particleNoise(particle.seed + 20) * .6) * clampUnit((now - particle.started) / 450), particle.seed % 7 ? '#5ce2c7' : '#d0b7f4', .65 + particleNoise(particle.seed + 5) * .65);
          if (launchBudget >= 1 && seeking < 180) {
            particle.mode = 'seeking'; particle.started = now; particle.from = { ...home }; launchBudget--; seeking++;
          }
        } else if (particle.mode === 'seeking') {
          const age = now - particle.started;
          const destination = { x: frontier.x + (particleNoise(particle.seed + 1) - .5) * 80, y: frontier.y + (particleNoise(particle.seed + 2) - .5) * 28 };
          Object.assign(particle, particleFlight(particle.from, destination, Math.min(.9, age / 1500), particle.seed, now, envelope));
          paint(particle, (.25 + particleNoise(particle.seed + 6) * .45) * Math.min(1, age / 110), '#9bddd6', 1.05);
          if (age > 1600) release(particle, now, true);
        } else if (particle.mode === 'return') {
          const progress = clampUnit((now - particle.started) / 650);
          Object.assign(particle, particleFlight(particle.from, home, progress, particle.seed, now, 0));
          paint(particle, .3 * (1 - progress), '#5ce2c7'); if (progress >= 1) release(particle, now);
        }
      }
      for (const [id, batch] of formations) {
        if (!batch.element.isConnected) {
          batch.particles.forEach(particle => release(particle, now, true)); formations.delete(id); continue;
        }
        const progress = particleFormation(now, batch.started, batch.confirmed, batch.gathered);
        const rect = batch.element.getBoundingClientRect(); batch.element.style.setProperty('--particle-ink', progress.ink.toFixed(3));
        if (progress.ink > 0 && !batch.landing) { batch.landing = true; batch.element.dataset.particleState = 'landing'; }
        if (now >= batch.started && batch.shape.dots.length) batch.particles.forEach((particle, index) => {
          const dot = batch.shape.dots[Math.floor(index * batch.shape.dots.length / batch.particles.length)];
          const ripple = dot.x / Math.max(1, batch.shape.width) * .08;
          const travel = clampUnit((progress.travel - ripple) / (1 - ripple));
          const destination = { x: rect.left - bounds.left + dot.x, y: rect.top - bounds.top + dot.y };
          const position = particleFlight(batch.origins[index], destination, travel, particle.seed, now, envelope);
          const blend = 1 - Math.exp(-dt / .04);
          particle.x += (position.x - particle.x) * blend; particle.y += (position.y - particle.y) * blend;
          paint(particle, (batch.confirmed === null ? .6 : .95) * (1 - progress.ink), travel > .82 ? '#f7f7f7' : particle.seed % 5 ? '#5ce2c7' : '#d0b7f4', travel > .9 ? 1.15 : 1.35);
        });
        if (progress.done) {
          settle(batch.element); batch.particles.forEach(particle => release(particle, now)); formations.delete(id);
        }
      }
      context.globalAlpha = 1;
      surface.dataset.motion = waiting ? 'listening' : formations.size ? 'forming' : current.active ? 'quiet' : 'ready';
      surface.dataset.audioLevel = level.toFixed(3); surface.dataset.formingWords = String(formations.size);
      surface.dataset.seekingParticles = String(seeking); surface.dataset.cloudParticles = String(pool.filter(p => p.mode === 'cloud').length);
      surface.dataset.reservoirX = center.x.toFixed(1); surface.dataset.reservoirY = center.y.toFixed(1);
      surface.dataset.frontierVisible = String(current.active || formations.size > 0);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); resizeObserver.disconnect();
      document.fonts.removeEventListener('loadingdone', refreshFonts);
      formations.forEach(batch => settle(batch.element)); context.clearRect(0, 0, width, height);
    };
  }, [viewport, wordRoot]);
  return <canvas ref={canvas} className="studio-speech-particles" data-testid="speech-particles" aria-hidden="true" />;
});
