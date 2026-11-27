// Тесты ядра (п. 26 ТЗ): маршруты, очереди, совместимые потоки, ConflictResolver,
// незавершённые манёвры, выезд, спецтранспорт, поломки, команды, метрики, поражение, нагрузка.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, STEP } from '../src/sim/world.js';
import { buildGeometry } from '../src/sim/roadgraph.js';
import { MAPS } from '../src/config/maps.js';
import { LEVELS } from '../src/config/levels.js';

const base = (over = {}) => Object.assign({
  id: 't', map: 'cross', spawn: { rate: 18, growth: 0, mix: { car: 1 }, routes: { S: .6, R: .2, L: .2 } },
  goal: { type: 'endless' }, maxErrors: 99, events: [],
}, over);
const calmOnly = { mix: { taxi: 0, car: 1 } };
// по умолчанию в тестах водители спокойные: проверяем саму механику движения
function world(level, seed = 1) {
  const w = createWorld(level, { seed, H: 860 });
  for (const c of w.cars) c.ch = { ...c.ch, risk: 0, rage: 'honk' };
  w.on(t => { if (t === 'spawned') {} });
  return w;
}
function calmify(w) { for (const c of w.cars) if (!c._calm) { c._calm = true; c.ch = { ...c.ch, risk: 0, rage: 'honk', patience: c.ch.patience }; } }
function run(w, sec, each, calm = true) {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n && !w.S.over; i++) { if (calm) calmify(w); each && each(w, i * STEP); w.step(STEP); }
}
// простой регулировщик: попеременно север-юг и запад-восток
const cycle = (period = 7) => (w, t) => {
  const ns = Math.floor(t / period) % 2 === 0;
  for (const A of w.geo.arms) w.setSignal(A, (A === 'N' || A === 'S') === ns ? 'GO' : 'STOP');
};

test('маршруты: прямо, направо и налево строятся на всех картах', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    const g = buildGeometry(m, 490, 860);
    assert.ok(g.paths.length >= 6, `${id}: мало маршрутов`);
    for (const p of g.paths) {
      assert.ok(p.sBoxIn > 0 && p.sBoxOut > p.sBoxIn && p.total > p.sBoxOut, `${id}/${p.id}: неверные отметки`);
      assert.ok(g.pathCells(p, 28).length > 0, `${id}/${p.id}: нет конфликтных зон`);
    }
    assert.ok(g.paths.some(p => p.move === 'L') && g.paths.some(p => p.move === 'R'), `${id}: нет поворотов`);
  }
});

test('машины появляются, едут по маршрутам и поворачивают', () => {
  const w = world(base());
  run(w, 90, cycle());
  assert.ok(w.S.stats.passed > 25, `проехало ${w.S.stats.passed}`);
  assert.ok(w.S.stats.turns > 5, 'были повороты');
  assert.equal(w.S.stats.crashes, 0);
});

test('очереди: на STOP стоят до стоп-линии и не наезжают друг на друга', () => {
  const w = world(base({ spawn: { rate: 24, growth: 0, mix: { car: .8, bus: .2 }, routes: { S: 1 } } }));
  run(w, 40, w2 => {
    for (const A of w2.geo.arms) w2.setSignal(A, 'STOP');
    const streams = {};
    for (const c of w2.cars) if (!c.dead && c.path && !c.free) (streams[c.path.entryKey] ||= []).push(c);
    for (const list of Object.values(streams)) {
      list.sort((a, b) => b.s - a.s);
      for (let i = 1; i < list.length; i++) {
        const gap = (list[i - 1].s - list[i - 1].len / 2) - (list[i].s + list[i].len / 2);
        if (!list[i - 1].granted) assert.ok(gap > -1, `наезд в очереди: ${gap.toFixed(1)}`);
      }
      for (const c of list) if (!c.granted && c.v < 1 && c.s > 50) assert.ok(c.s + c.len / 2 <= c.path.sStop + 1, 'стоящая машина за стоп-линией');
    }
  });
  assert.ok(w.S.queue > 10, 'очередь сформировалась');
});

test('два совместимых потока (север и юг) едут одновременно', () => {
  const w = world(base({ spawn: { approaches: ['N', 'S'], rate: 30, growth: 0, mix: { car: 1 }, routes: { S: 1 } } }));
  let both = 0;
  run(w, 45, w2 => {
    w2.setSignal('N', 'GO'); w2.setSignal('S', 'GO'); w2.setSignal('W', 'STOP'); w2.setSignal('E', 'STOP');
    const inBox = w2.cars.filter(c => c.granted && !c.cleared && !c.free);
    if (inBox.some(c => c.path.approach === 'N') && inBox.some(c => c.path.approach === 'S')) both++;
  });
  assert.ok(both > 30, `одновременно в перекрёстке: ${both} шагов`);
  assert.ok(!w.S.stats.safeOverlap, 'машины по правилам не касаются');
});

test('конфликтующие траектории не вызывают столкновений (все зелёные, водители дисциплинированы)', () => {
  for (const map of ['cross', 'big', 'teeWide', 'narrow']) {
    const w = world(base({ map, spawn: { rate: 28, growth: 0, mix: { car: .8, truck: .1, bus: .1 }, routes: { S: .5, R: .25, L: .25 } } }), 3);
    run(w, 90, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'GO'); });
    assert.equal(w.S.stats.crashes, 0, `${map}: аварии`);
    assert.ok(!w.S.stats.safeOverlap, `${map}: машины прошли друг сквозь друга (${w.S.stats.safeOverlap})`);
    assert.ok(w.S.stats.passed > 20, `${map}: поток не встал намертво (${w.S.stats.passed})`);
  }
});

test('переключение на STOP не прерывает начатый манёвр', () => {
  const w = world(base({ spawn: { rate: 20, growth: 0, mix: { car: 1 }, routes: { L: 1 } } }));
  let tracked = null;
  run(w, 30, (w2, t) => {
    for (const A of w2.geo.arms) w2.setSignal(A, 'GO');
    if (!tracked) tracked = w2.cars.find(c => c.granted && !c.cleared && c.s > c.path.sBoxIn + 5);
    if (tracked) return true;
  });
  assert.ok(tracked, 'нашли машину в перекрёстке');
  for (const A of w.geo.arms) w.setSignal(A, 'STOP');
  run(w, 6, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'STOP'); });
  assert.ok(tracked.cleared, 'машина завершила поворот после STOP');
});

test('PREPARE: после STOP новые машины не въезжают, а через секунду — STOP', () => {
  const w = world(base());
  run(w, 10, cycle(100));
  w.setSignal('N', 'STOP');
  assert.equal(w.sig.N.state, 'PREPARE');
  run(w, 1.3);
  assert.equal(w.sig.N.state, 'STOP');
});

test('без места на выезде в перекрёсток не въезжают', () => {
  const w = world(base({ modifiers: ['repair'], spawn: { rate: 20, growth: 0, mix: { car: 1 }, routes: { S: 1 } } }));
  const side = [...w.closed][0];
  let entered = 0;
  run(w, 40, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'GO'); for (const c of w2.cars) if (c.granted && c.path.exitSide === side && !c.violation) entered++; });
  assert.equal(entered, 0, 'машина въехала к закрытому выезду');
});

test('скорая получает приоритет и проезжает вовремя', () => {
  const w = world(base({ events: ['ambulance'], eventEvery: [1, 1] }));
  let task;
  w.on((t, d) => { if (t === 'task' && d.ev === 'ambulance') task = d; });
  run(w, 60, (w2) => {
    // регулировщик пропускает направление, где ждёт скорая
    const amb = w2.cars.find(c => c.emergency && !c.cleared);
    if (amb) for (const A of w2.geo.arms) w2.setSignal(A, A === amb.path.approach || w2.geo.compatible(A, amb.path.approach) ? 'GO' : 'STOP');
    else cycle()(w2, w2.S.time);
  });
  assert.ok(task, 'событие скорой произошло');
  assert.ok(w.S.stats.byType.amb >= 1, 'скорая проехала');
  assert.equal(w.S.errors, 0, 'скорая не опоздала');
});

test('поломка создаёт ситуацию, эвакуатор её устраняет', () => {
  const w = world(base({ events: ['breakdown'], eventEvery: [1, 1] }));
  let broken = null;
  run(w, 60, (w2) => { cycle()(w2, w2.S.time); if (!broken) broken = w2.cars.find(c => c.state === 'BROKEN'); if (broken) return; });
  assert.ok(broken, 'машина сломалась');
  assert.deepEqual(w.actionsFor(broken), ['tow']);
  assert.ok(w.carAction(broken.id, 'tow'));
  run(w, 3, cycle());
  assert.ok(!w.cars.includes(broken), 'сломанную машину увезли');
});

test('индивидуальные команды: пропустить на красный (безопасно) и объезд', () => {
  const w = world(base({ spawn: { rate: 16, growth: 0, mix: { car: 1 }, routes: { S: 1 } } }));
  run(w, 15, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'STOP'); });
  const first = w.cars.find(c => !c.granted && c.state === 'WAITING' && w.actionsFor(c).includes('letGo'));
  assert.ok(first, 'есть первая в очереди');
  assert.ok(w.actionsFor(first).includes('detour'));
  const before = first.path.move;
  assert.ok(w.carAction(first.id, 'detour'));
  assert.notEqual(first.path.move, before, 'маршрут изменён');
  assert.ok(w.carAction(first.id, 'letGo'));
  run(w, 4, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'STOP'); });
  assert.ok(first.granted, 'пропущена по команде');
});

test('хаос и терпение считаются и реагируют на пробку', () => {
  const w = world(base({ spawn: { rate: 30, growth: 0, mix: { car: 1 }, routes: { S: .6, R: .2, L: .2 } } }));
  run(w, 5, cycle());
  const calmChaos = w.S.chaos;
  run(w, 45, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'STOP'); });
  assert.ok(w.S.chaos > calmChaos + 20, `хаос вырос: ${calmChaos.toFixed(1)} → ${w.S.chaos.toFixed(1)}`);
  assert.ok(w.S.patience < 70, `терпение упало: ${w.S.patience.toFixed(1)}`);
  for (const k of ['Q', 'W', 'B', 'D']) assert.ok(w.S.chaosParts[k] >= 0 && w.S.chaosParts[k] <= 100);
});

test('поражение: максимальный хаос', () => {
  const w = world(base({ spawn: { rate: 40, growth: 0, mix: { car: 1 } } }));
  run(w, 300, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'STOP'); });
  assert.equal(w.S.over, true); assert.equal(w.S.win, false);
  assert.match(w.S.reason, /хаос/i);
});

test('поражение: лимит ошибок (нарушители без регулировщика)', () => {
  const w = createWorld(base({ maxErrors: 2, spawn: { rate: 26, growth: 0, mix: { taxi: .5, car: .5 } } }), { seed: 4, H: 860 });
  run(w, 400, w2 => { for (const A of w2.geo.arms) w2.setSignal(A, 'GO'); }, false);
  assert.equal(w.S.over, true); assert.equal(w.S.win, false);
  assert.ok(w.S.errors >= 2);
});

test('победа считает звёзды и итог', () => {
  let result;
  const w = world(base({ goal: { type: 'cars', n: 15 }, stars: [100, 150] }));
  w.on((t, d) => { if (t === 'finish') result = d; });
  run(w, 120, cycle());
  assert.ok(result && result.win, 'победа');
  assert.ok(result.stars >= 1 && result.stars <= 3);
  for (const k of ['score', 'passed', 'errors', 'avgWait', 'extras', 'maxChaos']) assert.ok(k in result, k);
});

test('все уровни карьеры загружаются и идут без исключений', () => {
  for (const lvl of LEVELS) {
    const w = createWorld(lvl, { seed: 2, H: 860 });
    run(w, 30, cycle(), false);
    assert.ok(w.S.time > 1, lvl.id);
  }
});

test('нагрузка: много машин, стабильная работа', () => {
  const w = world(base({ map: 'big', spawn: { rate: 70, growth: .5, mix: { car: .7, bus: .15, truck: .15 }, routes: { S: .5, R: .25, L: .25 } } }));
  let maxCars = 0;
  const t0 = Date.now();
  run(w, 120, (w2, t) => { cycle(6)(w2, t); maxCars = Math.max(maxCars, w2.cars.length); });
  const ms = Date.now() - t0;
  assert.ok(maxCars <= 42, `машин одновременно: ${maxCars}`);
  assert.ok(ms < 8000, `120 c симуляции за ${ms} мс`);
  assert.ok(!w.S.stats.safeOverlap);
});
