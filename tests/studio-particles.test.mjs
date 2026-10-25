import test from 'node:test';
import assert from 'node:assert/strict';
import { particleFormation, particleFlight, reservoirPoint, PARTICLE_FORMATION_MS } from '../lib/studio/particle-flow.ts';

test('waiting for recognition never invents permanent text, even during a long pause', () => {
  for (const now of [0, 200, 1000, 5000, 60000]) {
    const phase = particleFormation(now, 0, null);
    assert.equal(phase.ink, 0); assert.equal(phase.done, false); assert.ok(phase.travel <= .985);
  }
});
test('confirmation continues from existing dust instead of restarting travel', () => {
  const gathered = particleFormation(900, 0, null).travel;
  assert.ok(gathered > .7);
  assert.equal(particleFormation(900, 0, 900, gathered).travel, gathered);
  assert.ok(particleFormation(1050, 0, 900, gathered).ink > 0);
});
test('a confirmed word forms continuously and becomes ink within 650 ms', () => {
  let previous = 0, inkStarted = false;
  for (let now = 0; now <= PARTICLE_FORMATION_MS; now += 10) {
    const phase = particleFormation(now, 0, 0);
    assert.ok(phase.travel >= previous); previous = phase.travel;
    assert.ok(phase.ink >= 0 && phase.ink <= 1); inkStarted ||= phase.ink > 0;
    if (phase.ink > 0) assert.equal(phase.travel, 1, 'solid ink waits for the actual glyph geometry');
  }
  assert.equal(inkStarted, true);
  assert.deepEqual(particleFormation(PARTICLE_FORMATION_MS, 0, 0), {travel:1, ink:1, done:true});
});
test('a staggered word stays at its origin until its launch time', () => {
  assert.deepEqual(particleFormation(100, 200, 200), {travel:0, ink:0, done:false});
});
test('particle ribbons land exactly on the glyph without jitter after arrival', () => {
  const from = {x:300, y:460}, to = {x:95, y:220};
  for (const energy of [0, .5, 1]) for (const seed of [1, 54, 2800]) {
    assert.deepEqual(particleFlight(from, to, 1, seed, 12345, energy), to);
  }
});
test('voice energy agitates an anchored reservoir without moving its center', () => {
  const center = {x:300, y:460}; let movement = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const quiet = reservoirPoint(seed, 2000, center, 600, 0);
    const voiced = reservoirPoint(seed, 2000, center, 600, 1);
    assert.ok(Number.isFinite(voiced.x) && Number.isFinite(voiced.y));
    assert.ok(Math.abs(voiced.x - center.x) < 230 && Math.abs(voiced.y - center.y) < 60);
    movement += Math.hypot(voiced.x - quiet.x, voiced.y - quiet.y);
  }
  assert.ok(movement > 400); assert.deepEqual(center, {x:300, y:460});
});
