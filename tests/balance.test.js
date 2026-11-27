// п. 26.17 ТЗ: у всех уровней и испытаний есть реальные условия прохождения
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, STEP, worldWidth } from '../src/sim/world.js';
import { LEVELS, CHALLENGES } from '../src/config/levels.js';
import { createBot } from './bot.js';

function play(level, seed) {
  const w = createWorld(level, { seed, H: 900, W: worldWidth(level.map) });
  const bot = createBot(w);
  for (let i = 0; i < 60 * 260 && !w.S.over; i++) { bot(STEP); w.step(STEP); }
  return w.S;
}
for (const lvl of [...LEVELS, ...CHALLENGES]) {
  test(`проходим: ${lvl.id} «${lvl.name}»`, () => {
    const tries = [];
    for (const seed of [1, 2, 3, 4]) {
      const S = play(lvl, seed);
      tries.push(`${S.win ? 'win' : 'fail'}(${S.stars}★, err ${S.errors}, ${S.reason || ''})`);
      if (S.win) return;
    }
    assert.fail('бот не прошёл: ' + tries.join('; '));
  });
}
