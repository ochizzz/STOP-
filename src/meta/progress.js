/* ============ Progression / Economy / Rewards / Achievements / Daily ============
   Чистая логика над объектом сохранения. Награды проходят через журнал: одна награда — один раз. */
import { LEVELS, DISTRICTS, CHALLENGES, levelById, districtById } from '../config/levels.js';
import { REWARDS, REWARDS_EXTRA, STREAK, xpNeed, REP_TITLES, repTier, DAILY_POOL, ACHIEVEMENTS } from '../config/economy.js';
import { ITEMS, itemById } from '../config/items.js';
import { MODIFIERS } from '../config/events.js';
import { createRng } from '../sim/rng.js';

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const prevDay = key => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d - 1)); };
const daySeed = key => key.split('-').reduce((a, b) => a * 37 + Number(b), 7);

/* ---------- валюты и опыт ---------- */
export function grant(S, r = {}) {
  S.profile.cash += r.cash || 0;
  S.profile.tokens += r.tokens || 0;
  let levelUps = 0;
  if (r.xp) {
    S.profile.xp += r.xp;
    while (S.profile.xp >= xpNeed(S.profile.level)) { S.profile.xp -= xpNeed(S.profile.level); S.profile.level++; levelUps++; }
  }
  return levelUps;
}
// выдаёт награду только если ключа ещё нет в журнале
export function claimOnce(S, key, r) {
  if (S.rewards[key]) return null;
  S.rewards[key] = 1;
  return { ...r, levelUps: grant(S, r) };
}
export function spend(S, price, currency) {
  const k = currency === 'tokens' ? 'tokens' : 'cash';
  if (S.profile[k] < price) return false;
  S.profile[k] -= price; return true;
}

/* ---------- районы и уровни ---------- */
export const totalStars = S => Object.values(S.levels).reduce((n, l) => n + (l.stars || 0), 0);
export function unlockState(S, districtId) {
  const d = districtById(districtId), u = d.unlock || {};
  const need = [];
  if (u.stars && totalStars(S) < u.stars) need.push(`⭐ ${totalStars(S)}/${u.stars}`);
  if (u.playerLevel && S.profile.level < u.playerLevel) need.push(`уровень ${u.playerLevel}`);
  for (const id of u.levels || []) if (!(S.levels[id]?.stars > 0)) need.push(`пройти «${levelById(id).name}»`);
  for (const [dist, tier] of Object.entries(u.reputation || {})) if (repTier(S.rep[dist] || 0) < tier) need.push(`репутация «${districtById(dist).name}»: ${REP_TITLES[tier][1]}`);
  return { open: need.length === 0, need };
}
export const levelsOf = districtId => LEVELS.filter(l => l.district === districtId);
// уровень открыт, если район открыт и пройден предыдущий уровень района
export function levelOpen(S, id) {
  const l = levelById(id); if (!l || !unlockState(S, l.district).open) return false;
  const list = levelsOf(l.district), i = list.findIndex(x => x.id === id);
  return i === 0 || (S.levels[list[i - 1].id]?.stars || 0) > 0;
}
export function nextLevel(S) {
  for (const l of LEVELS) if (levelOpen(S, l.id) && !(S.levels[l.id]?.stars > 0)) return l;
  for (const l of LEVELS) if (levelOpen(S, l.id) && (S.levels[l.id]?.stars || 0) < 3) return l;
  return LEVELS[0];
}
export function repInfo(S, districtId) {
  const rep = S.rep[districtId] || 0, t = repTier(rep);
  const next = REP_TITLES[t + 1];
  return { rep, tier: t, title: REP_TITLES[t][1], next: next ? next[0] : null, prev: REP_TITLES[t][0] };
}

/* ---------- особые режимы ---------- */
export function endlessLevel(districtId) {
  const list = levelsOf(districtId);
  const mix = {}, events = new Set(['angry', 'jam']);
  for (const l of list) { for (const [k, v] of Object.entries(l.spawn.mix || {})) mix[k] = (mix[k] || 0) + v; for (const e of l.events || []) events.add(e); }
  const base = list[list.length - 1];
  return {
    id: `endless-${districtId}`, mode: 'endless', district: districtId, name: 'Бесконечная смена', map: base.map,
    boss: 'Смена без конца. Держи город, сколько сможешь.',
    spawn: { rate: 15, growth: .35, mix, routes: base.spawn.routes }, goal: { type: 'endless' }, maxErrors: 3, events: [...events],
  };
}
export function challengeLevel(id) { const c = CHALLENGES.find(x => x.id === id); return c && { ...c, mode: 'challenge', boss: 'Особое поручение. Условия жёсткие.', maxErrors: c.failOnCrash ? 1 : 3 }; }
export function dailyShiftLevel(S, day = dayKey()) {
  const rng = createRng(daySeed(day));
  const open = DISTRICTS.filter(d => unlockState(S, d.id).open);
  const d = rng.pick(open);
  const base = rng.pick(levelsOf(d.id).filter(l => !l.tutorial).length ? levelsOf(d.id).filter(l => !l.tutorial) : levelsOf(d.id));
  const pool = ['rain', 'night', 'holiday', 'heavy', 'brokenLight'];
  const mods = [];
  const n = rng.int(3);
  for (let i = 0; i < n; i++) { const m = rng.pick(pool); if (!mods.includes(m)) mods.push(m); }
  const goal = rng.next() < .5 ? { type: 'cars', n: 30 + rng.int(4) * 5 } : { type: 'time', t: 90 + rng.int(3) * 15 };
  const [dd, mm] = [day.slice(8), day.slice(5, 7)];
  return {
    id: `daily-${day}`, mode: 'daily', district: d.id, name: `Смена дня · ${dd}.${mm}`, map: base.map, modifiers: mods,
    boss: `Сегодня: ${mods.length ? mods.map(m => MODIFIERS[m].name.toLowerCase()).join(', ') : 'обычный день'}. Один шанс на награду в день.`,
    spawn: { ...base.spawn, rate: (base.spawn.rate || 16) + 2 }, goal, maxErrors: 3, events: [...new Set([...(base.events || []), 'ambulance', 'breakdown'])],
    stars: [goal.n ? goal.n * 12 : 400, goal.n ? goal.n * 16 : 540],
  };
}

/* ---------- ежедневные задания и серия входов ---------- */
export function ensureDay(S, day = dayKey()) {
  const D = S.daily;
  if (D.day !== day) {
    const rng = createRng(daySeed(day) + 11);
    const pool = [...DAILY_POOL], tasks = [];
    while (tasks.length < 3 && pool.length) tasks.push(pool.splice(rng.int(pool.length), 1)[0].id);
    D.day = day; D.tasks = tasks; D.prog = {}; D.claimed = {};
  }
  if (D.loginDay !== day) {
    D.streak = D.loginDay === prevDay(day) ? D.streak + 1 : 1;
    D.loginDay = day;
  }
  return D;
}
export const streakReward = S => STREAK[(Math.max(1, S.daily.streak) - 1) % STREAK.length];
export const streakReady = (S, day = dayKey()) => S.daily.streakClaimed !== day;
export function claimStreak(S, day = dayKey()) {
  if (!streakReady(S, day)) return null;
  S.daily.streakClaimed = day;
  return claimOnce(S, `streak:${day}`, streakReward(S));
}
export const dailyTasks = S => S.daily.tasks.map(id => { const t = DAILY_POOL.find(x => x.id === id); const p = Math.min(t.n, S.daily.prog[t.stat] || 0); return { ...t, p, done: p >= t.n, claimed: !!S.daily.claimed[id] }; });
export function claimDaily(S, id) {
  const t = dailyTasks(S).find(x => x.id === id);
  if (!t || !t.done || t.claimed) return null;
  S.daily.claimed[id] = true;
  return claimOnce(S, `daily:${S.daily.day}:${id}`, { cash: t.cash });
}

/* ---------- достижения ---------- */
export function achievementProgress(S) {
  return ACHIEVEMENTS.map(a => ({ ...a, p: Math.min(a.n, S.stats[a.stat] || 0), done: !!S.achievements[a.id] }));
}
function checkAchievements(S) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (S.achievements[a.id] || (S.stats[a.stat] || 0) < a.n) continue;
    S.achievements[a.id] = true;
    const r = claimOnce(S, `ach:${a.id}`, a.reward);
    got.push({ ...a, reward: r });
  }
  return got;
}

// оплата повторной смены — не больше 10 в день
function replayPay(S, day) {
  const n = Object.keys(S.rewards).filter(k => k.startsWith(`replay:${day}:`)).length;
  return n < 10 ? claimOnce(S, `replay:${day}:${n}`, REWARDS.replay) : null;
}

/* ---------- итог смены: награды, статистика, репутация ---------- */
export function applyResult(S, level, res, day = dayKey()) {
  ensureDay(S, day);
  const sum = { cash: 0, xp: 0, tokens: 0, levelUps: 0, newStars: 0, achievements: [], rep: 0, extras: [], firstClear: false };
  const add = r => { if (!r) return; sum.cash += r.cash || 0; sum.xp += r.xp || 0; sum.tokens += r.tokens || 0; sum.levelUps += r.levelUps || 0; };
  const mode = level.mode || 'career';
  // статистика
  const st = S.stats;
  st.shifts++; if (res.win) st.wins++;
  st.cars += res.passed; st.bus += res.byType.bus || 0; st.amb += res.byType.amb || 0; st.truck += res.byType.truck || 0;
  st.crashes += res.crashes || 0; st.eventTasks += res.eventTasks?.done || 0; st.playTime += res.time || 0;
  if (res.win && res.errors === 0) st.cleanWins++;
  if (res.win && res.maxChaos < 40) st.calmWins++;
  // ежедневные счётчики
  const P = S.daily.prog, inc = (k, v) => { if (v) P[k] = (P[k] || 0) + v; };
  inc('shifts', 1); inc('cars', res.passed); inc('bus', res.byType.bus || 0); inc('amb', res.byType.amb || 0);
  inc('eventTasks', res.eventTasks?.done || 0); if (res.win && res.errors === 0) inc('clean', 1);

  if (mode === 'career') {
    const rec = S.levels[level.id] ||= { stars: 0, best: 0, plays: 0 };
    rec.plays++; rec.best = Math.max(rec.best, res.score);
    if (res.win) {
      let any = false;
      for (let s = 1; s <= res.stars; s++) { const r = claimOnce(S, `lvl:${level.id}:${s}`, REWARDS['star' + s]); if (r) { any = true; add(r); } }
      if (!any) add(replayPay(S, day));
      if (res.stars > rec.stars) { sum.newStars = res.stars - rec.stars; st.starsTotal += sum.newStars; inc('stars', sum.newStars); rec.stars = res.stars; }
      sum.firstClear = any;
      for (const e of res.extras || []) if (e.done) { const r = claimOnce(S, `extra:${level.id}:${e.type}`, { cash: REWARDS_EXTRA }); if (r) { add(r); sum.extras.push(e.type); } }
    } else {
      // утешительная выплата за провал — не больше 5 в день, чтобы не фармили
      const n = Object.keys(S.rewards).filter(k => k.startsWith(`fail:${day}:`)).length;
      if (n < 5) add(claimOnce(S, `fail:${day}:${n}`, REWARDS.fail));
    }
    const rep = res.win ? 30 + res.stars * 30 : 8;
    S.rep[level.district] = (S.rep[level.district] || 0) + rep; sum.rep = rep;
  } else if (mode === 'challenge') {
    S.records.challenges[level.id] = Math.max(S.records.challenges[level.id] || 0, res.win ? res.score : 0);
    if (res.win) add(claimOnce(S, `ch:${level.id}`, { ...REWARDS.challenge, tokens: level.hard ? 1 : 0 }) || replayPay(S, day));
    else add(claimOnce(S, `fail:${day}:${Object.keys(S.rewards).filter(k => k.startsWith(`fail:${day}:`)).length}`, REWARDS.fail));
  } else if (mode === 'daily') {
    S.records.daily[day] = Math.max(S.records.daily[day] || 0, res.score);
    if (res.win) add(claimOnce(S, `dailyshift:${day}`, REWARDS.daily));
  } else if (mode === 'endless') {
    const prev = S.records.endless[level.district] || 0;
    S.records.endless[level.district] = Math.max(prev, res.score);
    sum.record = res.score > prev;
    const r = { cash: Math.min(200, Math.floor(res.score / 12)), xp: Math.floor(res.score / 20) };
    add({ ...r, levelUps: grant(S, r) });
    const rep = Math.floor(res.score / 25);
    S.rep[level.district] = (S.rep[level.district] || 0) + rep; sum.rep = rep;
  }
  sum.achievements = checkAchievements(S);
  for (const a of sum.achievements) add(a.reward);
  return sum;
}

/* ---------- магазин ---------- */
export function buyItem(S, id) {
  const it = itemById(id);
  if (!it || S.owned.includes(id)) return false;
  if (!spend(S, it.price, it.currency)) return false;
  S.owned.push(id); return true;
}
export function equipItem(S, id) {
  const it = itemById(id);
  if (!it || !S.owned.includes(id)) return false;
  S.equip[it.cat] = id; return true;
}
export const shopItems = cat => ITEMS.filter(i => i.cat === cat);
