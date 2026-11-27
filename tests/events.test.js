// Каждое событие запускается и проходит без исключений (п. 17 ТЗ)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, STEP } from '../src/sim/world.js';
import { EVENTS, MODIFIERS } from '../src/config/events.js';
import { createBot } from './bot.js';

for (const id of Object.keys(EVENTS)) {
  test(`событие ${id} (${EVENTS[id].id})`, () => {
    const lvl = { id: 'e', map: 'cross', spawn: { rate: 16, growth: 0, mix: { car: 1 } }, goal: { type: 'endless' }, maxErrors: 99, events: [id], eventEvery: [1, 2] };
    const w = createWorld(lvl, { seed: 3, H: 900, W: 400 });
    const seen = [];
    w.on((t, d) => { if (t === 'event' && d.id === id) seen.push(d); });
    const bot = createBot(w);
    for (let i = 0; i < 60 * 90; i++) { bot(STEP); w.step(STEP); }
    assert.ok(seen.length > 0, 'событие произошло');
  });
}
for (const m of Object.keys(MODIFIERS)) {
  test(`модификатор ${m}`, () => {
    const lvl = { id: 'm', map: 'cross', modifiers: [m], spawn: { rate: 16, growth: 0, mix: { car: 1 } }, goal: { type: 'endless' }, maxErrors: 99, events: [] };
    const w = createWorld(lvl, { seed: 5, H: 900, W: 400 });
    const bot = createBot(w);
    for (let i = 0; i < 60 * 40; i++) { bot(STEP); w.step(STEP); }
    assert.ok(w.S.time > 39);
  });
}
