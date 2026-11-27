// Проверка согласованности конфигов: ошибки в данных ловим до запуска игры
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/config/data.js';

test('у каждого задания есть понятная цель и награда', () => {
  for (const m of [...D.MISSIONS, D.INTRO_MISSION]) {
    assert.ok(D.GOAL_TEXT[m.goal.type], `${m.id}: нет текста цели ${m.goal.type}`);
    assert.ok(D.GOAL_ICON[m.goal.type], `${m.id}: нет иконки цели`);
    assert.ok(D.DIFF_REWARD[m.diff], `${m.id}: нет награды для сложности ${m.diff}`);
    if (m.theme) assert.ok(D.THEMES[m.theme], `${m.id}: неизвестный район ${m.theme}`);
  }
});

test('id заданий уникальны', () => {
  const ids = D.MISSIONS.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('веса появления ссылаются на существующий транспорт', () => {
  const ok = new Set([...Object.keys(D.TYPES), 'cortege']);
  for (const [d, w] of Object.entries(D.DISTRICT_W)) {
    assert.ok(D.THEMES[d], `нет района ${d}`);
    for (const k of Object.keys(w)) assert.ok(ok.has(k), `${d}: неизвестный тип ${k}`);
  }
  for (const m of D.MISSIONS) for (const k of Object.keys(m.w || {})) assert.ok(ok.has(k), `${m.id}: неизвестный тип ${k}`);
});

test('характеры и названия покрывают транспорт', () => {
  for (const t of Object.keys(D.TYPES)) assert.ok(D.NAME[t], `нет названия для ${t}`);
  for (const t of Object.keys(D.RAM_TYPES)) assert.ok(D.TYPES[t] && D.RAM_REASON[t], `таран: ${t}`);
});

test('районы города существуют', () => {
  for (const th of D.CITY.rowTheme) assert.ok(D.THEMES[th]);
  assert.equal(D.CITY.rowTheme.length, D.CITY.rows.length);
  assert.equal(D.CITY.hStreets.length, D.CITY.rows.length);
  assert.equal(D.CITY.vStreets.length, D.CITY.cols.length);
});

test('гардероб: уникальные id и бесплатная стартовая вещь', () => {
  for (const [cat, items] of Object.entries(D.WARDROBE)) {
    const ids = items.map(i => i.id);
    assert.equal(new Set(ids).size, ids.length, cat);
    assert.ok(items.some(i => i.price === 0), `${cat}: нет бесплатной вещи`);
  }
});

test('опыт и звания растут монотонно', () => {
  for (let l = 1; l < 40; l++) assert.ok(D.xpNeed(l + 1) > D.xpNeed(l));
  assert.equal(D.rankFor(1), 'Стажёр');
  assert.equal(D.rankFor(99), 'Генерал жезла');
});
