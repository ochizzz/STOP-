// Тесты правил перекрёстка без браузера (критерии п. 26 ТЗ, часть 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, STEP } from '../src/sim/sim.js';
import { createClock } from '../src/sim/clock.js';

const calm = { patience: 1e-6 };   // водители без злости: проверяем чистое движение
const run = (sim, seconds, each) => { const n = Math.round(seconds / STEP); for (let i = 0; i < n; i++) { sim.step(STEP); each && each(sim); } };
const snapshot = sim => JSON.stringify({ t: sim.S.time.toFixed(4), score: sim.S.score.toFixed(3), lives: sim.S.lives, stats: sim.S.stats, cars: sim.S.cars.map(c => [c.type, c.lane, c.t.toFixed(3)]) });

test('одинаковое зерно — одинаковая смена', () => {
  const a = createSim({ theme: 'taxi', seed: 42, H: 820 });
  const b = createSim({ theme: 'taxi', seed: 42, H: 820 });
  run(a, 40); run(b, 40);
  assert.equal(snapshot(a), snapshot(b));
});

test('результат не зависит от частоты кадров (30 / 60 / 144 Гц)', () => {
  const result = fps => {
    const sim = createSim({ theme: 'wedding', seed: 7, H: 820 });
    const clock = createClock(STEP, 100);
    const frames = Math.round(30 * fps);
    for (let i = 0; i < frames; i++) {
      if (i === Math.round(8 * fps)) sim.setAxis(1);        // переключения в одно и то же время
      if (i === Math.round(17 * fps)) sim.setAxis(0);
      clock.advance(1 / fps, dt => sim.step(dt));
    }
    return sim;
  };
  const s30 = result(30), s60 = result(60), s144 = result(144);
  // шагов может отличаться на один из-за округления последнего кадра
  assert.ok(Math.abs(s30.S.time - s60.S.time) <= STEP * 1.01);
  assert.ok(Math.abs(s144.S.time - s60.S.time) <= STEP * 1.01);
  assert.deepEqual(s30.S.stats, s60.S.stats);
  assert.deepEqual(s144.S.stats, s60.S.stats);
});

test('машины появляются и пересекают перекрёсток на зелёный', () => {
  const sim = createSim({ theme: 'taxi', seed: 3, H: 820, ...calm });
  run(sim, 25);
  assert.ok(sim.S.uid > 5, 'машины появляются');
  assert.ok(sim.S.stats.cars > 0, 'хотя бы одна проехала');
});

test('на красный очередь стоит до стоп-линии и не наезжает друг на друга', () => {
  const sim = createSim({ theme: 'taxi', seed: 11, H: 820, w: { taxi: 0, goose: 0, cow: 0, clown: 0, cortege: 0 }, ...calm });
  run(sim, 30, s => {
    for (let li = 0; li < 4; li++) {
      const L = s.LANES[li];
      const lane = s.S.cars.filter(c => c.lane === li && s.inLane(c)).sort((a, b) => b.t - a.t);
      for (let i = 1; i < lane.length; i++) {
        const gap = (lane[i - 1].t - lane[i - 1].len / 2) - (lane[i].t + lane[i].len / 2);
        assert.ok(gap > -0.5, `полоса ${li}: машины наехали друг на друга (${gap.toFixed(2)})`);
      }
      if (L.axis !== s.S.green && s.S.green !== -1) {
        for (const c of lane) if (!c.committed && c.t + c.len / 2 < L.stopT + 3 && c.v < 1) {
          assert.ok(c.t + c.len / 2 <= L.stopT + 1, `полоса ${li}: стоящая машина за стоп-линией`);
        }
      }
    }
  });
  assert.equal(sim.S.green, 0, 'всё время горела вертикаль');
});

test('жёлтая фаза: новая ось открывается только когда перекрёсток свободен', () => {
  const sim = createSim({ theme: 'taxi', seed: 5, H: 820, ...calm });
  run(sim, 12);
  sim.setAxis(1);
  assert.equal(sim.S.green, -1, 'включилась жёлтая фаза');
  let opened = false;
  run(sim, 5, s => {
    if (!opened && s.S.green === 1) {
      opened = true;
      const busy = s.S.cars.some(c => s.inLane(c) && s.LANES[c.lane].axis === 0 &&
        c.t + c.len / 2 > s.LANES[c.lane].boxStartT && c.t - c.len / 2 < s.LANES[c.lane].boxEndT);
      assert.ok(!busy || s.S.amber >= 3.5, 'в момент переключения на перекрёстке остались машины старой оси');
    }
  });
  assert.ok(opened, 'ось переключилась');
});

test('передумал во время жёлтого — мгновенный возврат', () => {
  const sim = createSim({ theme: 'taxi', seed: 5, H: 820 });
  sim.setAxis(1); assert.equal(sim.S.green, -1);
  sim.setAxis(0); assert.equal(sim.S.green, 0);
});

test('без регулировщика смена рано или поздно проваливается', () => {
  const sim = createSim({ theme: 'taxi', seed: 9, H: 820 });
  const events = [];
  sim.on((type, d) => { if (type === 'finish') events.push(d); });
  run(sim, 240);
  assert.equal(sim.S.over, true);
  assert.equal(sim.S.win, false);
  assert.equal(events.length, 1, 'событие finish ровно одно');
  assert.ok(events[0].reason.length > 0, 'есть причина провала');
});

test('цель «продержись» засчитывается вовремя', () => {
  const sim = createSim({ theme: 'goose', seed: 2, H: 820, goal: { type: 'survive', t: 5 }, ...calm });
  run(sim, 4.9);
  assert.equal(sim.S.over, false);
  run(sim, .2);
  assert.equal(sim.S.over, true);
  assert.equal(sim.S.win, true);
});
