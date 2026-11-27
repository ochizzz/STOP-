// Модули загружаются без браузера (основа будущих тестов симуляции)
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('модуль игры импортируется в Node без DOM', async () => {
  const { Game } = await import('../src/game/game.js');
  assert.equal(typeof Game.start, 'function');
  assert.equal(typeof Game.init, 'function');
});
