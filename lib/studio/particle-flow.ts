export type ParticlePoint = { x: number; y: number };

export const PARTICLE_FORMATION_MS = 650;
export const clampUnit = (value: number) => Math.max(0, Math.min(1, value));
export const particleNoise = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const smooth = (value: number) => { const t = clampUnit(value); return t * t * (3 - 2 * t); };

/** Hypotheses gather into dust; only a confirmed word becomes permanent ink. */
export function particleFormation(now: number, started: number, confirmed: number | null, gathered = 0) {
  const preview = .985 * smooth((now - started) / 1050);
  if (confirmed === null) return { travel: preview, ink: 0, done: false };
  const elapsed = Math.max(0, now - confirmed);
  const flightMs = Math.max(110, 430 * (1 - clampUnit(gathered)));
  const flight = clampUnit(elapsed / flightMs);
  const travel = gathered + (1 - gathered) * (1 - Math.pow(1 - flight, 3));
  // Finish the geometry before exposing ink; a gathered hypothesis needs a shorter landing.
  return { travel, ink: smooth((elapsed - flightMs) / 220), done: elapsed >= flightMs + 220 };
}

/** An irregular turning volume; speech expands and agitates the same points. */
export function reservoirPoint(seed: number, now: number, center: ParticlePoint, width: number, energy: number): ParticlePoint {
  const time = now / 1000;
  const angle = particleNoise(seed) * Math.PI * 2 + time * .065;
  const depth = particleNoise(seed + 7) * 2 - 1;
  const radius = Math.pow(particleNoise(seed + 2), .42);
  const spread = Math.min(142, width * .3);
  const deformation = 1 + .17 * Math.sin(angle * 3 + time * .7 + depth * 2);
  return {
    x: center.x + Math.cos(angle) * radius * spread * deformation * (1 + energy * .25)
      + Math.sin(time * (9 + particleNoise(seed + 3) * 7) + seed) * energy * 7,
    y: center.y + Math.sin(angle) * radius * (17 + energy * 17) * (.6 + Math.abs(depth) * .55)
      + Math.sin(time * 1.5 + depth * 7) * 5 + Math.cos(time * 13 + seed) * energy * 5
  };
}

/** A curved ribbon from the voice cloud to the exact live glyph position. */
export function particleFlight(from: ParticlePoint, to: ParticlePoint, progress: number, seed: number, now: number, energy: number): ParticlePoint {
  const t = clampUnit(progress), inverse = 1 - t;
  const bend = (particleNoise(seed + 4) - .5) * Math.min(130, 35 + Math.abs(to.x - from.x) * .18);
  const lift = Math.min(90, 28 + Math.abs(to.y - from.y) * .15);
  const a = inverse * inverse * inverse, b = 3 * inverse * inverse * t, c = 3 * inverse * t * t, d = t * t * t;
  const turbulence = Math.sin(now * .009 + seed) * inverse * inverse * (2 + energy * 9);
  return {
    x: a * from.x + b * (from.x + bend) + c * (to.x + bend * .35) + d * to.x + turbulence,
    y: a * from.y + b * (from.y - lift) + c * (to.y + lift) + d * to.y + turbulence * .6
  };
}
