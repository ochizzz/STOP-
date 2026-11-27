// Прогрессия, экономика, сохранения (п. 13–16, 23 ТЗ)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, writeSave, migrateV2, checksum } from '../src/meta/save.js';
import * as G from '../src/meta/progress.js';
import { LEVELS, DISTRICTS, CHALLENGES } from '../src/config/levels.js';
import { REWARDS } from '../src/config/economy.js';

const mem = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const win = (stars, over = {}) => Object.assign({ win: true, stars, score: 500, passed: 30, byType: { car: 28, bus: 2 }, errors: 0, crashes: 0, maxChaos: 30, extras: [{ type: 'noCrash', done: true }], eventTasks: { done: 1, failed: 0 }, time: 100 }, over);
const lose = () => ({ win: false, stars: 0, score: 120, passed: 8, byType: { car: 8 }, errors: 3, crashes: 2, maxChaos: 90, extras: [], eventTasks: { done: 0, failed: 1 }, time: 60 });

test('сохранение: запись, чтение и контрольная сумма', () => {
  const st = mem(), d = defaultSave();
  d.profile.cash = 777; writeSave(d, st);
  assert.equal(loadSave(st).profile.cash, 777);
  // ручная правка ломает контрольную сумму — подхватывается резервная копия
  d.profile.cash = 888; writeSave(d, st);
  const o = JSON.parse(st.getItem('stop3')); o.data = o.data.replace('888', '999999'); st.setItem('stop3', JSON.stringify(o));
  const r = loadSave(st);
  assert.equal(r.profile.cash, 777, 'восстановлено из резервной копии');
  assert.ok(r.notices.some(n => /резервн/.test(n)));
});

test('миграция с 2.x: бустеры и улучшения возвращены, косметика сохранена', () => {
  const old = { coins: 100, lvl: 4, xp: 20, name: 'ТЕСТ', inv: { evac: 2, siren: 0, donut: 1, kit: 1 }, up: { zen: 2, patience: 0, bonus: 1 },
    owned: { hat: ['cap', 'crown'], uniform: ['blue', 'pink'], baton: ['classic', 'fish'] }, eq: { hat: 'crown', uniform: 'pink', baton: 'fish' }, stats: { shifts: 12, cars: 300 } };
  const d = migrateV2(old);
  assert.equal(d.profile.cash, 100 + 2 * 150 + 100 + 250 + 200 + 450 + 300);
  assert.ok(d.owned.includes('h-crown') && d.owned.includes('b-fish'));
  assert.equal(d.equip.hat, 'h-crown');
  assert.equal(d.profile.level, 4);
  assert.equal(d.stats.cars, 300);
  const st = mem(); st.setItem('stop2', JSON.stringify(old));
  assert.equal(loadSave(st).profile.name, 'ТЕСТ', 'старое сохранение подхватывается автоматически');
});

test('награда за звёзды начисляется один раз', () => {
  const S = defaultSave(), lvl = LEVELS[0];
  const cash0 = S.profile.cash;
  const achCash = r => r.achievements.reduce((n, x) => n + (x.reward?.cash || 0), 0);
  const a = G.applyResult(S, lvl, win(2), '2026-11-27');
  assert.equal(a.cash - achCash(a), REWARDS.star1.cash + REWARDS.star2.cash + 25);
  const b = G.applyResult(S, lvl, win(2), '2026-11-27');
  assert.equal(b.cash - achCash(b), REWARDS.replay.cash, 'повтор — только оплата смены');
  const c = G.applyResult(S, lvl, win(3), '2026-11-27');
  assert.equal(c.cash - achCash(c), REWARDS.star3.cash, 'доплата только за новую звезду');
  assert.equal(S.levels[lvl.id].stars, 3);
  assert.equal(S.profile.cash, cash0 + a.cash + b.cash + c.cash);
});

test('утешительные выплаты за провал ограничены', () => {
  const S = defaultSave();
  let total = 0;
  for (let i = 0; i < 12; i++) { const r = G.applyResult(S, LEVELS[1], lose(), '2026-11-27'); total += r.cash - r.achievements.reduce((n, x) => n + (x.reward?.cash || 0), 0); }
  assert.equal(total, 5 * REWARDS.fail.cash);
});

test('районы открываются по условиям', () => {
  const S = defaultSave();
  assert.ok(G.unlockState(S, 'oldtown').open);
  assert.ok(!G.unlockState(S, 'sleep').open);
  assert.ok(G.levelOpen(S, 'old-1') && !G.levelOpen(S, 'old-2'));
  G.applyResult(S, LEVELS.find(l => l.id === 'old-1'), win(2), '2026-11-27');
  assert.ok(G.levelOpen(S, 'old-2'));
  G.applyResult(S, LEVELS.find(l => l.id === 'old-2'), win(1), '2026-11-27');
  assert.ok(G.unlockState(S, 'sleep').open, 'спальный район: 3 звезды и пройден old-2');
  assert.ok(!G.unlockState(S, 'center').open);
  assert.ok(G.unlockState(S, 'center').need.length > 0, 'понятно, чего не хватает');
});

test('у каждого района есть уровни и условия открытия', () => {
  for (const d of DISTRICTS) assert.ok(G.levelsOf(d.id).length >= 3, d.id);
  for (const c of CHALLENGES) assert.ok(G.challengeLevel(c.id));
});

test('ежедневные задания: три в день, награда один раз', () => {
  const S = defaultSave();
  G.ensureDay(S, '2026-11-27');
  assert.equal(S.daily.tasks.length, 3);
  const t = G.dailyTasks(S)[0];
  S.daily.prog[t.stat] = t.n;
  assert.ok(G.claimDaily(S, t.id));
  assert.equal(G.claimDaily(S, t.id), null);
  G.ensureDay(S, '2026-11-28');
  assert.equal(Object.keys(S.daily.claimed).length, 0, 'новый день — новые задания');
});

test('серия входов: растёт день за днём и сбрасывается при пропуске', () => {
  const S = defaultSave();
  G.ensureDay(S, '2026-11-01'); assert.equal(S.daily.streak, 1);
  assert.ok(G.claimStreak(S, '2026-11-01')); assert.equal(G.claimStreak(S, '2026-11-01'), null);
  G.ensureDay(S, '2026-11-02'); assert.equal(S.daily.streak, 2);
  G.ensureDay(S, '2026-11-05'); assert.equal(S.daily.streak, 1);
});

test('смена дня одинакова для одной даты и даёт награду один раз', () => {
  const S = defaultSave();
  const a = G.dailyShiftLevel(S, '2026-11-27'), b = G.dailyShiftLevel(S, '2026-11-27');
  assert.deepEqual(a, b);
  const r1 = G.applyResult(S, a, win(1), '2026-11-27'), r2 = G.applyResult(S, a, win(1), '2026-11-27');
  assert.ok(r1.cash >= REWARDS.daily.cash && r1.tokens >= 1);
  assert.equal(r2.cash, 0);
});

test('магазин: только косметика, покупка и надевание', () => {
  const S = defaultSave(); S.profile.cash = 1000;
  assert.ok(G.buyItem(S, 'b-neon'));
  assert.ok(!G.buyItem(S, 'b-neon'), 'второй раз не продаётся');
  assert.ok(G.equipItem(S, 'b-neon'));
  assert.equal(S.equip.baton, 'b-neon');
  assert.ok(!G.buyItem(S, 'h-crown'), 'не хватает жетонов');
});

test('достижение выдаётся один раз', () => {
  const S = defaultSave();
  const r = G.applyResult(S, LEVELS[0], win(1), '2026-11-27');
  assert.ok(r.achievements.some(a => a.id === 'first_day'));
  const r2 = G.applyResult(S, LEVELS[0], win(1), '2026-11-27');
  assert.ok(!r2.achievements.some(a => a.id === 'first_day'));
});

test('контрольная сумма стабильна', () => { assert.equal(checksum('abc'), checksum('abc')); assert.notEqual(checksum('abc'), checksum('abd')); });
