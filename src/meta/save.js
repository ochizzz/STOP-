/* ============ SaveManager: версия, миграция, целостность, резервная копия ============ */
import { DEFAULT_EQUIP } from '../config/items.js';

export const SAVE_VERSION = 3;
const KEY = 'stop3', BAK = 'stop3_bak', OLD = 'stop2', SALT = 'stop-patrol-v3';

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    profile: { name: 'ЖЕЗЛ 01', level: 1, xp: 0, cash: 150, tokens: 0 },
    stats: { shifts: 0, wins: 0, cars: 0, bus: 0, amb: 0, truck: 0, crashes: 0, cleanWins: 0, calmWins: 0, starsTotal: 0, eventTasks: 0, playTime: 0 },
    levels: {},                 // id → { stars, best, plays }
    records: { endless: {}, challenges: {}, daily: {} },
    rewards: {},                // журнал выданных наград: ключ → 1
    rep: {},                    // район → очки репутации
    owned: Object.values(DEFAULT_EQUIP),
    equip: { ...DEFAULT_EQUIP },
    achievements: {},
    daily: { day: '', tasks: [], prog: {}, claimed: {}, loginDay: '', streak: 0, streakClaimed: '' },
    settings: { sound: true, vibro: true, effects: true, hints: true, quality: 'high' },
    notices: [],
  };
}

// FNV-1a — защита от повреждений и ручной правки сохранения
export function checksum(str) {
  let h = 0x811c9dc5;
  const s = SALT + str;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function pack(data) { const json = JSON.stringify(data); return JSON.stringify({ data: json, sum: checksum(json) }); }
function unpack(raw) {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.data !== 'string' || checksum(o.data) !== o.sum) return null;
    return JSON.parse(o.data);
  } catch (e) { return null; }
}

// Глубокое слияние с умолчаниями: новые поля появляются у старых сохранений
function withDefaults(d) {
  const def = defaultSave();
  const merge = (a, b) => { for (const k in a) { if (b[k] === undefined) b[k] = a[k]; else if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]); } return b; };
  return merge(def, d);
}

/* Миграция с версии 2.x (ключ stop2): бустеры и улучшения больше не продаются —
   потраченное возвращается наличными; косметика и статистика сохраняются. */
const OLD_PRICES = { evac: 150, siren: 150, donut: 100, kit: 250 };
const OLD_UP = { zen: [200, 450, 900], patience: [250, 550, 1000], bonus: [300, 600, 1100] };
const MAP_HAT = { cap: 'h-cap', ushanka: 'h-ushanka', cowboy: 'h-cowboy', hardhat: 'h-hardhat', crown: 'h-crown', cone: 'h-cone' };
const MAP_UNI = { blue: 'u-blue', reflex: 'u-reflex', khaki: 'u-khaki', pink: 'u-pink', black: 'u-black', gold: 'u-gold' };
const MAP_BAT = { classic: 'b-classic', neon: 'b-neon', laser: 'b-laser', baguette: 'b-baguette', fish: 'b-fish', gold: 'b-gold' };
export function migrateV2(old) {
  const d = defaultSave();
  let refund = 0;
  for (const k in OLD_PRICES) refund += (old.inv?.[k] || 0) * OLD_PRICES[k];
  for (const k in OLD_UP) for (let i = 0; i < (old.up?.[k] || 0); i++) refund += OLD_UP[k][i] || 0;
  d.profile.name = old.name || d.profile.name;
  d.profile.level = Math.max(1, old.lvl || 1);
  d.profile.xp = old.xp || 0;
  d.profile.cash = (old.coins || 0) + refund;
  const own = new Set(d.owned);
  for (const id of old.owned?.hat || []) MAP_HAT[id] && own.add(MAP_HAT[id]);
  for (const id of old.owned?.uniform || []) MAP_UNI[id] && own.add(MAP_UNI[id]);
  for (const id of old.owned?.baton || []) MAP_BAT[id] && own.add(MAP_BAT[id]);
  d.owned = [...own];
  if (old.eq) {
    if (MAP_HAT[old.eq.hat]) d.equip.hat = MAP_HAT[old.eq.hat];
    if (MAP_UNI[old.eq.uniform]) d.equip.uniform = MAP_UNI[old.eq.uniform];
    if (MAP_BAT[old.eq.baton]) d.equip.baton = MAP_BAT[old.eq.baton];
  }
  const st = old.stats || {};
  Object.assign(d.stats, { shifts: st.shifts || 0, cars: st.cars || 0, crashes: st.crashes || 0, amb: st.amb || 0 });
  if (old.settings) Object.assign(d.settings, old.settings);
  if (refund) d.notices.push(`Магазин теперь только с косметикой. Бустеры и улучшения возвращены: +${refund} 💵`);
  d.notices.push('Добро пожаловать в STOP! 3.0: новый город, районы и настоящие перекрёстки.');
  return d;
}

export function loadSave(storage = globalThis.localStorage) {
  let restoredFromBackup = false;
  try {
    let d = unpack(storage.getItem(KEY));
    if (!d && storage.getItem(KEY)) { d = unpack(storage.getItem(BAK)); restoredFromBackup = !!d; }
    if (!d) {
      const oldRaw = storage.getItem(OLD);
      if (oldRaw) { try { d = migrateV2(JSON.parse(oldRaw)); } catch (e) { d = null; } }
    }
    d = withDefaults(d || defaultSave());
    if (restoredFromBackup) d.notices.push('Сохранение было повреждено — восстановили резервную копию.');
    d.v = SAVE_VERSION;
    return d;
  } catch (e) { return defaultSave(); }
}

export function writeSave(d, storage = globalThis.localStorage) {
  try {
    const cur = storage.getItem(KEY);
    if (cur && unpack(cur)) storage.setItem(BAK, cur);       // предыдущая целая копия
    storage.setItem(KEY, pack(d));
    return true;
  } catch (e) { return false; }
}
export function resetSave(storage = globalThis.localStorage) { try { storage.removeItem(KEY); storage.removeItem(BAK); storage.removeItem(OLD); } catch (e) {} }
