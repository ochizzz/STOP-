// Фиксированный шаг и детерминизм (п. 24 ТЗ): правила не зависят от частоты кадров
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, STEP } from '../src/sim/world.js';
import { createClock } from '../src/sim/clock.js';
import { LEVELS } from '../src/config/levels.js';

const lvl = LEVELS.find(l => l.id === 'center-1');
const snap = w => JSON.stringify({ t: w.S.time.toFixed(3), s: Math.round(w.S.score), e: w.S.errors, st: w.S.stats.passed, cars: w.cars.map(c => [c.id, c.type, c.s.toFixed(2)]) });
const ctl = (w, t) => { const ns = Math.floor(t / 7) % 2 === 0; for (const A of w.geo.arms) w.setSignal(A, (A === 'N' || A === 'S') === ns ? 'GO' : 'STOP'); };

test('одинаковое зерно — одинаковая смена', () => {
  const a = createWorld(lvl, { seed: 42, H: 900 }), b = createWorld(lvl, { seed: 42, H: 900 });
  for (let i = 0; i < 60 * 40; i++) { ctl(a, a.S.time); ctl(b, b.S.time); a.step(STEP); b.step(STEP); }
  assert.equal(snap(a), snap(b));
});

test('30 / 60 / 144 Гц дают одинаковый результат', () => {
  const run = fps => {
    const w = createWorld(lvl, { seed: 7, H: 900 }), clock = createClock(STEP, 100);
    for (let i = 0; i < 30 * fps; i++) clock.advance(1 / fps, dt => { ctl(w, w.S.time); w.step(dt); });
    return w;
  };
  const a = run(30), b = run(60), c = run(144);
  assert.ok(Math.abs(a.S.time - b.S.time) <= STEP * 1.01 && Math.abs(c.S.time - b.S.time) <= STEP * 1.01);
  assert.equal(a.S.stats.passed, b.S.stats.passed);
  assert.equal(c.S.stats.passed, b.S.stats.passed);
});
