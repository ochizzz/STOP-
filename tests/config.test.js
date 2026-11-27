// Согласованность конфигов (п. 22 ТЗ): ошибки в данных ловим до запуска
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES, CHARACTERS } from '../src/config/vehicles.js';
import { MAPS, THEMES } from '../src/config/maps.js';
import { LEVELS, DISTRICTS, CHALLENGES } from '../src/config/levels.js';
import { EVENTS, MODIFIERS } from '../src/config/events.js';
import { ACHIEVEMENTS, DAILY_POOL, STREAK, REP_TITLES, xpNeed } from '../src/config/economy.js';
import { ITEMS, CATEGORIES, DEFAULT_EQUIP } from '../src/config/items.js';
import { GOAL_TEXT, EXTRA_TEXT } from '../src/config/texts.js';

test('транспорт: характеры существуют, параметры осмысленны', () => {
  for (const [id, v] of Object.entries(VEHICLES)) {
    assert.ok(v.len > 0 && v.wid > 0 && v.vmax > 0 && v.accel > 0 && v.brake > 0, id);
    for (const c of Object.keys(v.chars || {})) assert.ok(CHARACTERS[c], `${id}: нет характера ${c}`);
  }
});

test('уровни и испытания ссылаются на существующие карты, районы, события и транспорт', () => {
  const ids = new Set();
  for (const l of [...LEVELS, ...CHALLENGES]) {
    assert.ok(!ids.has(l.id), `повтор id ${l.id}`); ids.add(l.id);
    assert.ok(MAPS[l.map], `${l.id}: карта ${l.map}`);
    assert.ok(DISTRICTS.find(d => d.id === l.district), `${l.id}: район`);
    assert.ok(GOAL_TEXT[l.goal.type], `${l.id}: цель`);
    for (const e of l.events || []) assert.ok(EVENTS[e], `${l.id}: событие ${e}`);
    for (const m of l.modifiers || []) assert.ok(MODIFIERS[m], `${l.id}: модификатор ${m}`);
    for (const t of Object.keys(l.spawn.mix || {})) assert.ok(VEHICLES[t], `${l.id}: транспорт ${t}`);
    for (const e of l.extra || []) assert.ok(EXTRA_TEXT[e.type], `${l.id}: доп. задача ${e.type}`);
    for (const A of l.spawn.approaches || []) assert.ok(MAPS[l.map].arms.includes(A), `${l.id}: нет стороны ${A}`);
  }
});

test('районы: темы, по три уровня, условия открытия', () => {
  for (const d of DISTRICTS) {
    assert.ok(THEMES[d.theme], d.id);
    assert.equal(LEVELS.filter(l => l.district === d.id).length, 3, d.id);
  }
  assert.deepEqual(DISTRICTS[0].unlock, {}, 'первый район открыт сразу');
});

test('магазин: только косметика, уникальные id, бесплатная вещь в каждой категории', () => {
  const ids = ITEMS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CATEGORIES) assert.ok(ITEMS.some(i => i.cat === c.id && i.price === 0), c.id);
  for (const i of ITEMS) assert.ok(CATEGORIES.some(c => c.id === i.cat) && ['cash', 'tokens'].includes(i.currency), i.id);
  for (const id of Object.values(DEFAULT_EQUIP)) assert.ok(ids.includes(id));
});

test('экономика: таблицы заполнены', () => {
  assert.equal(STREAK.length, 7);
  assert.ok(DAILY_POOL.length >= 3);
  assert.ok(ACHIEVEMENTS.length >= 6);
  assert.ok(REP_TITLES.length >= 6);
  for (let l = 1; l < 50; l++) assert.ok(xpNeed(l + 1) > xpNeed(l));
});
