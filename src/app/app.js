/* ============ STOP! — приложение: город, режимы, прогресс, магазин ============ */
import * as THREE from 'three';
import { LEVELS, DISTRICTS, CHALLENGES, levelById, districtById } from '../config/levels.js';
import { MODIFIERS, EVENTS } from '../config/events.js';
import { STREAK, xpNeed, REP_TITLES } from '../config/economy.js';
import { CATEGORIES, ITEMS, RARITY, itemById } from '../config/items.js';
import { BOSS_GENERIC, COMMENTS, GOAL_TEXT, EXTRA_TEXT } from '../config/texts.js';
import { loadSave, writeSave, resetSave } from '../meta/save.js';
import * as G from '../meta/progress.js';
import { copModel } from '../render/meshes.js';
import { Shift } from '../ui/shift.js';
import { audio, sfx, settings } from '../ui/sound.js';

const $ = id => document.getElementById(id);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const INK = '#1F2433', RED = '#E5484D';

export function startApp() {
  let S = loadSave();
  Object.assign(settings, S.settings);
  const save = () => writeSave(S);
  G.ensureDay(S); save();

  /* ---------- общие окна ---------- */
  let toastT = 0, modalLock = false;
  const toast = t => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1700); };
  const openSheet = html => { $('sheet').innerHTML = '<div class="grab"></div>' + html; $('sheet').classList.add('on'); $('veil').classList.add('on'); };
  const closeSheet = () => { $('sheet').classList.remove('on'); if (!$('modal').classList.contains('on')) $('veil').classList.remove('on'); };
  const openModal = (html, lock = false) => { modalLock = lock; $('modal').innerHTML = html; $('modal').classList.add('on'); $('veil').classList.add('on'); };
  const closeModal = () => { const m = $('modal'); m.classList.remove('on'); modalLock = false; setTimeout(() => { if (!m.classList.contains('on')) m.innerHTML = ''; }, 200); if (!$('sheet').classList.contains('on')) $('veil').classList.remove('on'); };
  $('veil').addEventListener('click', () => { if (modalLock) return; closeSheet(); closeModal(); });
  document.addEventListener('click', e => { if (e.target.closest('button')) { audio(); if (!e.target.closest('#scrGame')) sfx.tap(); } }, true);
  const warnSVG = (inner = '!', w = 22, h = 20) => `<svg viewBox="-31 -32 62 55" width="${w}" height="${h}"><polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/><polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="${RED}" stroke-width="7" stroke-linejoin="round"/><text x="0" y="5" font-size="${inner.length > 1 ? 19 : 23}" font-weight="900" font-family="Rubik,sans-serif" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${inner}</text></svg>`;
  const curHTML = r => [r.cash ? `💵 ${fmt(r.cash)}` : '', r.tokens ? `⭐ ${r.tokens}` : '', r.xp ? `✦ ${r.xp} XP` : ''].filter(Boolean).map(x => `<span>${x}</span>`).join('');

  /* ---------- шапка ---------- */
  function refresh() {
    G.ensureDay(S);
    $$('.cash').forEach(e => e.textContent = fmt(S.profile.cash));
    $$('.tokens').forEach(e => e.textContent = S.profile.tokens);
    $('lvl').textContent = S.profile.level;
    $('plateName').textContent = S.profile.name; $('plateName2').textContent = S.profile.name;
    $('xpText').textContent = `${S.profile.xp} / ${xpNeed(S.profile.level)} XP`;
    $('xpBar').style.width = Math.min(100, S.profile.xp / xpNeed(S.profile.level) * 100) + '%';
    const b1 = $('btnStreak').querySelector('.badge'); b1.innerHTML = warnSVG('!'); b1.classList.toggle('on', G.streakReady(S));
    const dn = G.dailyTasks(S).filter(t => t.done && !t.claimed).length;
    const b2 = $('btnDaily').querySelector('.badge'); b2.innerHTML = warnSVG(String(dn)); b2.classList.toggle('on', dn > 0);
    const b3 = $('btnDailyShift').querySelector('.badge'); b3.innerHTML = warnSVG('!'); b3.classList.toggle('on', !S.rewards[`dailyshift:${G.dayKey()}`]);
    const nl = G.nextLevel(S);
    $('playSub').textContent = `${districtById(nl.district).name} · ${nl.name}`;
  }

  /* ---------- навигация ---------- */
  function go(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.scr === id));
    if (id === 'scrShop') renderShop();
    if (id === 'scrWardrobe') renderWardrobe(); else preview.stop();
    if (id === 'scrSettings') renderSettings();
    if (id === 'scrProfile') renderProfile();
    if (id === 'scrMap') renderCity();
    refresh();
  }
  $$('#nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.scr)));
  $('btnProfile').onclick = () => go('scrProfile');

  /* =====================================================
     КАРТА ГОРОДА: районы и уровни
     ===================================================== */
  const MAP = { w: 400, h: 1000, cols: [114, 200, 286], rows: [110, 260, 410, 600, 750, 900], river: [478, 532] };
  const TINT = { oldtown: '#ECE3D3', sleep: '#E2EAD8', center: '#E5E6E9', market: '#F1E5D2', industrial: '#E1DFD9', highway: '#DCE8D6' };
  const FOOT = { oldtown: '#DCCFBB', sleep: '#D3E2C6', center: '#D6D8DE', market: '#E6D3B6', industrial: '#CFCBC2', highway: '#C9DDBF' };
  function seeded(seed) { let s = seed; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
  function buildCity() {
    const { w, h, cols, rows } = MAP, RW = 18, hr = RW / 2, rand = seeded(20261127);
    const bounds = [0, (rows[0] + rows[1]) / 2, (rows[1] + rows[2]) / 2, 505, (rows[3] + rows[4]) / 2, (rows[4] + rows[5]) / 2, h];
    let s = `<defs><filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#1F2433" flood-opacity=".22"/></filter>
      <clipPath id="rc"><path d="M-10,452 C110,428 240,548 410,498 L410,548 C240,598 110,478 -10,504 Z"/></clipPath></defs>`;
    s += `<rect width="${w}" height="${h}" fill="#EEEBE4"/>`;
    DISTRICTS.forEach((d, i) => { s += `<rect x="0" y="${bounds[i]}" width="${w}" height="${bounds[i + 1] - bounds[i]}" fill="${TINT[d.id]}"/>`; });
    // кварталы
    const xs = [[0, cols[0] - hr], [cols[0] + hr, cols[1] - hr], [cols[1] + hr, cols[2] - hr], [cols[2] + hr, w]];
    const ys = [[0, rows[0] - hr]]; for (let i = 0; i < rows.length - 1; i++) ys.push([rows[i] + hr, rows[i + 1] - hr]); ys.push([rows[5] + hr, h]);
    const distAt = y => DISTRICTS[Math.min(5, bounds.findIndex((b, i) => y >= b && y < bounds[i + 1]))].id;
    for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
      const d = distAt((y0 + y1) / 2), bx = x0 + 5, by = y0 + 5, bw = x1 - x0 - 10, bh = y1 - y0 - 10;
      if (bw < 16 || bh < 16) continue;
      if (d === 'sleep' || d === 'highway') {
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="${FOOT[d]}"/>`;
        const n = Math.round(bw * bh / 1100);
        for (let i = 0; i < n; i++) s += `<circle cx="${(bx + 8 + rand() * (bw - 16)).toFixed(1)}" cy="${(by + 8 + rand() * (bh - 16)).toFixed(1)}" r="${(3 + rand() * 3).toFixed(1)}" fill="#BFD6AE"/>`;
      } else {
        const big = d === 'industrial', nx = Math.max(1, Math.round(bw / (big ? 70 : 44))), ny = Math.max(1, Math.round(bh / (big ? 60 : 40)));
        const cw = bw / nx, ch = bh / ny;
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (rand() > .1) s += `<rect x="${(bx + i * cw + 2).toFixed(1)}" y="${(by + j * ch + 2).toFixed(1)}" width="${(cw - 4).toFixed(1)}" height="${(ch - 4).toFixed(1)}" rx="2.5" fill="${FOOT[d]}"/>`;
      }
    }
    // река, мосты, дороги
    s += `<path d="M-10,452 C110,428 240,548 410,498 L410,548 C240,598 110,478 -10,504 Z" fill="#BFDDF0" stroke="#A7CDE6" stroke-width="1.5"/>`;
    for (const c of cols) s += `<rect x="${c - hr - 4}" y="400" width="${RW + 8}" height="220" fill="#C9C2B4" clip-path="url(#rc)"/>`;
    for (const c of cols) s += `<line x1="${c}" y1="-5" x2="${c}" y2="${h + 5}" stroke="#DAD5CA" stroke-width="${RW + 4}"/>`;
    for (const r of rows) s += `<line x1="-5" y1="${r}" x2="${w + 5}" y2="${r}" stroke="#DAD5CA" stroke-width="${RW + 4}"/>`;
    for (const c of cols) s += `<line x1="${c}" y1="-5" x2="${c}" y2="${h + 5}" stroke="#FFFFFF" stroke-width="${RW}"/>`;
    for (const r of rows) s += `<line x1="-5" y1="${r}" x2="${w + 5}" y2="${r}" stroke="#FFFFFF" stroke-width="${RW}"/>`;
    s += `<g id="distLayer"></g><g id="lvLayer"></g>`;
    $('city').innerHTML = s;
    MAP.bounds = bounds;
  }
  const T = (x, y, t, size = 9, fill = '#8E897E', weight = 800, ls = 1.4) => `<text x="${x}" y="${y}" font-family="Rubik,sans-serif" font-weight="${weight}" font-size="${size}" letter-spacing="${ls}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${t}</text>`;
  function renderCity() {
    if (!$('lvLayer')) buildCity();
    const { cols, rows, bounds } = MAP;
    let dl = '', lv = '';
    const next = G.nextLevel(S);
    DISTRICTS.forEach((d, i) => {
      const u = G.unlockState(S, d.id), y = rows[i] - 75 + (i >= 3 ? 0 : 0);
      const ly = rows[i] + 48;
      const rp = G.repInfo(S, d.id);
      dl += T(157, ly - 5, d.name.toUpperCase()) + T(157, ly + 8, u.open ? rp.title : d.feature, 7.5, '#A9A497', 700, .3);
      if (!u.open) {
        dl += `<rect x="0" y="${bounds[i]}" width="400" height="${bounds[i + 1] - bounds[i]}" fill="#EEEBE4" opacity=".62"/>`;
        dl += `<g transform="translate(200,${rows[i]})" filter="url(#soft)"><rect x="-120" y="-15" width="240" height="30" rx="15" fill="#fff"/></g>${T(200, rows[i] + 1, '🔒 ' + u.need.join(' · '), 8.5, INK, 700, 0)}`;
      }
      G.levelsOf(d.id).forEach((l, k) => {
        const x = cols[k], yy = rows[i], rec = S.levels[l.id] || { stars: 0 }, open = G.levelOpen(S, l.id);
        const stars = [1, 2, 3].map(n => `<text x="${(n - 2) * 9}" y="20" font-size="9" text-anchor="middle" fill="${n <= rec.stars ? '#F2A900' : '#CFCAC0'}">★</text>`).join('');
        if (!u.open) return;
        if (!open) { lv += `<g class="lv locked" transform="translate(${x},${yy})"><circle r="10" fill="#fff" filter="url(#soft)"/><text y="1" font-size="10" text-anchor="middle" dominant-baseline="central">🔒</text></g>`; return; }
        const isNext = l.id === next.id;
        if (rec.stars > 0) lv += `<g class="lv" data-id="${l.id}" transform="translate(${x},${yy})"><circle r="13" fill="#fff" filter="url(#soft)"/><text y="1" font-size="11" font-weight="800" font-family="Rubik" text-anchor="middle" dominant-baseline="central" fill="${INK}">${k + 1}</text>${stars}</g>`;
        else lv += `<g class="lv" data-id="${l.id}" transform="translate(${x},${yy - 16})"><g class="bob">${isNext ? '<circle class="pulse" cy="12" r="20" fill="#E5484D" opacity=".18"/>' : ''}
          <g filter="url(#soft)"><polygon points="0,-19 19,13 -19,13" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"/></g>
          <polygon points="0,-19 19,13 -19,13" fill="#fff" stroke="${RED}" stroke-width="5" stroke-linejoin="round"/>
          <text y="4" font-size="13" font-weight="900" font-family="Rubik" text-anchor="middle" dominant-baseline="central" fill="${INK}">${k + 1}</text></g></g>`;
      });
    });
    $('distLayer').innerHTML = dl; $('lvLayer').innerHTML = lv;
  }
  $('city').addEventListener('click', e => { const g = e.target.closest('.lv[data-id]'); if (g) openLevel(levelById(g.dataset.id)); });
  $('btnPlay').onclick = () => openLevel(G.nextLevel(S));

  /* ---------- бриф начальника перед сменой ---------- */
  function goalText(l) { return l.goal.type === 'endless' ? GOAL_TEXT.endless() : GOAL_TEXT[l.goal.type](l.goal); }
  function openLevel(l, opts = {}) {
    if (!l) return;
    const d = districtById(l.district), rec = S.levels[l.id];
    const mods = (l.modifiers || []).map(m => `<span>${MODIFIERS[m].icon} ${MODIFIERS[m].name}</span>`);
    const evs = [...new Set(l.events || [])].map(id => `<span>${EVENTS[id].icon} ${EVENTS[id].name}</span>`);
    openSheet(`<div class="lhead"><span class="ic">${l.icon || d.icon}</span><div><h3>${l.name}</h3><small>${d.name} · ${d.feature}${rec ? ` · лучший счёт ${rec.best}` : ''}</small></div></div>
      <div class="brief"><span class="av">👮‍♂️</span><div><b>Распоряжение начальника смены</b><span>${l.boss || BOSS_GENERIC[0]}</span></div></div>
      <div class="tlist"><div class="main">🎯 ${goalText(l)}${l.timeLimit ? ` · за ${l.timeLimit} с` : ''}</div>${(l.extra || []).map(e => `<div>☆ ${EXTRA_TEXT[e.type](e)}</div>`).join('')}</div>
      ${mods.length || evs.length ? `<div class="chips">${mods.join('')}${evs.join('')}</div>` : ''}
      <div class="chips"><span>❌ Ошибок можно: ${(l.maxErrors || 3) - 1}</span>${l.patienceFail ? '<span>😤 Терпение не должно лопнуть</span>' : ''}${l.failQueue ? `<span>📏 Очередь ≤ ${l.failQueue}</span>` : ''}</div>
      <div class="btns"><button class="btn red wide" id="goShift">Заступить на смену</button></div>`);
    $('goShift').onclick = () => { closeSheet(); startShift(l); };
  }

  /* =====================================================
     СМЕНА
     ===================================================== */
  let current = null;
  function startShift(l) {
    current = l;
    $('scrGame').classList.add('on');
    const seed = l.mode === 'daily' ? G.dayKey().split('-').reduce((a, b) => a * 31 + Number(b), 1) : Math.floor(Math.random() * 2 ** 31);
    requestAnimationFrame(() => Shift.start({
      level: l, seed, cosmetics: S.equip,
      hints: S.settings.hints && (l.tutorial || S.stats.shifts < 2),
      onEnd: res => finishShift(l, res),
    }));
  }
  function toCity() { closeModal(); Shift.stop(); $('scrGame').classList.remove('on'); go('scrMap'); }
  function finishShift(l, res) {
    const sum = G.applyResult(S, l, res);
    save();
    const tone = !res.win ? 'bad' : res.stars === 3 ? 'perfect' : res.stars === 2 ? 'good' : 'good';
    const comment = COMMENTS[tone][Math.floor(Math.random() * COMMENTS[tone].length)];
    const endless = l.mode === 'endless';
    const nextL = l.mode !== 'challenge' && l.mode !== 'daily' && !endless ? LEVELS[LEVELS.findIndex(x => x.id === l.id) + 1] : null;
    const canNext = res.win && nextL && G.levelOpen(S, nextL.id);
    const title = endless ? 'Смена окончена' : res.win ? (res.stars === 3 ? 'Идеальная смена!' : 'Смена завершена') : 'Провал смены';
    openModal(`<h2>${title}</h2>
      ${!endless && res.win ? `<div class="stars">${[1, 2, 3].map(i => `<i data-s="${i}">⭐</i>`).join('')}</div>` : ''}
      ${!res.win && res.snapshot ? `<div class="shot"><img src="${res.snapshot}" alt=""><span>момент истины</span></div>` : ''}
      ${res.reason ? `<p><b>${res.reason}</b></p>` : ''}
      <div class="comment">«${comment}»</div>
      <div class="kv"><div><small>Очки</small><b>${fmt(res.score)}${sum.record ? ' 🏆' : ''}</b></div><div><small>Машин пропущено</small><b>${res.passed}</b></div>
        <div><small>Ошибки</small><b>${res.errors}</b></div><div><small>Среднее ожидание</small><b>${res.avgWait.toFixed(1)} с</b></div></div>
      <div class="tlist">${endless ? '' : `<div class="${res.win ? 'ok' : 'no'} main">${res.win ? '✓' : '✗'} ${goalText(l)}</div>`}
        ${(res.extras || []).map(e => `<div class="${e.done ? 'ok' : 'no'}">${e.done ? '✓' : '✗'} ${e.text}</div>`).join('')}
        ${res.eventTasks.done + res.eventTasks.failed ? `<div>⚠️ Поручения: ${res.eventTasks.done} из ${res.eventTasks.done + res.eventTasks.failed}</div>` : ''}</div>
      ${curHTML(sum) ? `<div class="reward">${curHTML(sum)}</div>` : ''}
      ${sum.levelUps ? `<p>⬆️ Новый уровень регулировщика: <b>${S.profile.level}</b></p>` : ''}
      ${sum.rep ? `<p>Репутация района +${sum.rep}</p>` : ''}
      ${sum.achievements.length ? `<div class="chips">${sum.achievements.map(a => `<span>🏅 ${a.name}</span>`).join('')}</div>` : ''}
      <div class="btns row2"><button class="btn white" id="rAgain">Повторить</button>${canNext ? '<button class="btn red" id="rNext">Продолжить</button>' : ''}</div>
      <div class="btns"><button class="btn ${canNext ? 'white' : 'red'}" id="rCity">Вернуться в город</button></div>`, true);
    $$('.stars i').forEach((el, i) => setTimeout(() => { if (i < res.stars) { el.classList.add('on'); sfx.star(i); } }, 250 + i * 280));
    $('rAgain').onclick = () => { closeModal(); startShift(l); };
    $('rCity').onclick = toCity;
    if (canNext) $('rNext').onclick = () => { closeModal(); Shift.stop(); $('scrGame').classList.remove('on'); renderCity(); openLevel(nextL); };
    refresh();
  }
  function openPause() {
    if (!Shift.isRunning()) return;
    Shift.pause();
    openModal(`<h2>Перекур</h2><p>Водители ждут и злятся…</p>
      <div class="btns"><button class="btn red" id="pRes">Продолжить</button><button class="btn white" id="pRe">Начать заново</button><button class="btn white" id="pQuit">Сдать смену</button></div>`, true);
    $('pRes').onclick = () => { closeModal(); Shift.resume(); };
    $('pRe').onclick = () => { closeModal(); startShift(current); };
    $('pQuit').onclick = toCity;
  }
  $('gPause').addEventListener('click', openPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) openPause(); });

  /* =====================================================
     РЕЖИМЫ: награда дня, задания, испытания, смена дня, бесконечная
     ===================================================== */
  $('btnStreak').onclick = () => {
    const ready = G.streakReady(S), day = ((Math.max(1, S.daily.streak) - 1) % 7);
    const r = G.streakReward(S);
    openModal(`<h2>Награда дня</h2><p>Заходи каждый день — награда растёт. Серия: <b>${S.daily.streak}</b></p>
      <div class="streak">${STREAK.map((x, i) => `<div class="${i < day || (i === day && !ready) ? 'done' : i === day ? 'now' : ''}">день ${i + 1}<b>${x.cash ? '💵' + x.cash : '⭐' + x.tokens}</b></div>`).join('')}</div>
      <div class="btns">${ready ? `<button class="btn red" id="sClaim">Забрать ${r.cash ? '💵 ' + r.cash : '⭐ ' + r.tokens}</button>` : '<p>Сегодня уже получено. До завтра!</p>'}<button class="btn white" id="sClose">Закрыть</button></div>`);
    $('sClose').onclick = closeModal;
    if (ready) $('sClaim').onclick = () => { const g = G.claimStreak(S); save(); sfx.coin(); toast('Получено: ' + (g.cash ? `💵 ${g.cash}` : `⭐ ${g.tokens}`)); closeModal(); refresh(); };
  };
  function openDaily() {
    const tasks = G.dailyTasks(S);
    openModal(`<h2>Задания дня</h2><p>Три новых задания каждый день</p>
      <div class="dlist">${tasks.map(t => `<div class="drow"><span class="ic">${t.icon}</span><div class="mid"><b>${t.text}</b><i class="bar"><u style="width:${t.p / t.n * 100}%"></u></i></div>
        ${t.claimed ? '<b>✅</b>' : `<button class="btn ${t.done ? 'red' : 'white'}" data-q="${t.id}" ${t.done ? '' : 'disabled'}>${t.done ? '💵 ' + t.cash : t.p + '/' + t.n}</button>`}</div>`).join('')}</div>
      <div class="btns"><button class="btn white" id="dClose">Закрыть</button></div>`);
    $('dClose').onclick = closeModal;
    $$('#modal [data-q]').forEach(b => b.onclick = () => { if (G.claimDaily(S, b.dataset.q)) { save(); sfx.coin(); refresh(); openDaily(); } });
  }
  $('btnDaily').onclick = openDaily;
  $('btnChallenges').onclick = () => {
    openModal(`<h2>Испытания</h2><p>Короткие сценарии с особыми условиями. Первая победа — большая награда.</p>
      <div class="picker">${CHALLENGES.map(c => { const open = G.unlockState(S, c.district).open, done = S.rewards[`ch:${c.id}`];
        return `<button data-ch="${c.id}" ${open ? '' : 'disabled'}><span class="ic">${c.icon}</span><span><b>${c.name}${c.hard ? ' · сложно' : ''}</b><small>${open ? (done ? `✓ пройдено · рекорд ${S.records.challenges[c.id] || 0}` : `💵 250${c.hard ? ' + ⭐1' : ''} за первую победу`) : '🔒 ' + districtById(c.district).name}</small></span></button>`; }).join('')}</div>
      <div class="btns"><button class="btn white" id="cClose">Закрыть</button></div>`);
    $('cClose').onclick = closeModal;
    $$('#modal [data-ch]').forEach(b => b.onclick = () => { closeModal(); openLevel(G.challengeLevel(b.dataset.ch)); });
  };
  $('btnDailyShift').onclick = () => { const l = G.dailyShiftLevel(S); l.icon = '📅'; openLevel(l); };
  $('btnEndless').onclick = () => {
    openModal(`<h2>Бесконечная смена</h2><p>Трафик растёт, события случайны. Держись, сколько сможешь.</p>
      <div class="picker">${DISTRICTS.map(d => { const open = G.unlockState(S, d.id).open;
        return `<button data-d="${d.id}" ${open ? '' : 'disabled'}><span class="ic">${d.icon}</span><span><b>${d.name}</b><small>${open ? `рекорд ${S.records.endless[d.id] || 0}` : '🔒 район закрыт'}</small></span></button>`; }).join('')}</div>
      <div class="btns"><button class="btn white" id="eClose">Закрыть</button></div>`);
    $('eClose').onclick = closeModal;
    $$('#modal [data-d]').forEach(b => b.onclick = () => { closeModal(); openLevel(G.endlessLevel(b.dataset.d)); });
  };

  /* =====================================================
     МАГАЗИН И ГАРДЕРОБ
     ===================================================== */
  let shopCat = 'uniform', wCat = 'uniform';
  const swatch = it => it.cat === 'uniform' ? `<span class="sw" style="background:${it.color}"></span>`
    : it.cat === 'baton' ? `<span class="sw"><svg viewBox="0 0 40 40" width="32" height="32"><g transform="rotate(-45 20 20)"><rect x="17" y="4" width="6" height="32" rx="3" fill="${it.main}" ${it.glow ? `style="filter:drop-shadow(0 0 4px ${it.glow})"` : ''}/><rect x="17" y="12" width="6" height="4" fill="${it.stripe}"/><rect x="17" y="22" width="6" height="4" fill="${it.stripe}"/></g></svg></span>`
    : `<span class="sw">${it.icon}</span>`;
  const price = it => it.price === 0 ? 'Бесплатно' : `${it.currency === 'tokens' ? '⭐' : '💵'} ${fmt(it.price)}`;
  function tabs(el, cur, onPick) {
    el.innerHTML = CATEGORIES.map(c => `<button data-c="${c.id}" class="${c.id === cur ? 'on' : ''}">${c.name}</button>`).join('');
    el.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.c));
  }
  function renderShop() {
    tabs($('shopTabs'), shopCat, c => { shopCat = c; renderShop(); });
    $('shopItems').innerHTML = G.shopItems(shopCat).map(it => {
      const own = S.owned.includes(it.id);
      return `<button class="item" data-i="${it.id}"><i class="rar" style="background:${RARITY[it.rarity].color}"></i>${swatch(it)}<b>${it.name}</b><small style="color:${RARITY[it.rarity].color}">${RARITY[it.rarity].name}</small><span class="pr ${own ? 'own' : ''}">${own ? '✓ Есть' : price(it)}</span></button>`;
    }).join('');
    $$('#shopItems .item').forEach(b => b.onclick = () => {
      const it = itemById(b.dataset.i);
      if (S.owned.includes(it.id)) { wCat = it.cat; go('scrWardrobe'); return; }
      const afford = it.currency === 'tokens' ? S.profile.tokens >= it.price : S.profile.cash >= it.price;
      openModal(`<div style="display:flex;justify-content:center">${swatch(it).replace('class="sw"', 'class="sw" style="width:80px;height:80px;font-size:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:' + (it.color || '#F3F1EC') + '"')}</div>
        <h2>${it.name}</h2><p style="color:${RARITY[it.rarity].color}">${RARITY[it.rarity].name} · ${CATEGORIES.find(c => c.id === it.cat).name}</p>
        <div class="btns"><button class="btn red" id="bBuy" ${afford ? '' : 'disabled'}>Купить · ${price(it)}</button>${afford ? '' : `<p>Не хватает ${it.currency === 'tokens' ? 'звёздных жетонов' : 'наличных'}</p>`}<button class="btn white" id="bNo">Отмена</button></div>`);
      $('bNo').onclick = closeModal;
      if (afford) $('bBuy').onclick = () => { if (G.buyItem(S, it.id)) { G.equipItem(S, it.id); save(); sfx.coin(); toast('Куплено и надето!'); closeModal(); renderShop(); refresh(); } };
    });
  }
  function renderWardrobe() {
    tabs($('wTabs'), wCat, c => { wCat = c; renderWardrobe(); });
    $('wItems').innerHTML = G.shopItems(wCat).map(it => {
      const own = S.owned.includes(it.id), on = S.equip[it.cat] === it.id;
      return `<button class="item ${on ? 'sel' : ''} ${own ? '' : 'lock'}" data-i="${it.id}">${swatch(it)}<b>${it.name}</b><span class="pr ${on ? 'own' : ''}">${on ? '✓ Надето' : own ? 'Надеть' : '🔒 ' + price(it)}</span></button>`;
    }).join('');
    $$('#wItems .item').forEach(b => b.onclick = () => {
      const it = itemById(b.dataset.i);
      if (!S.owned.includes(it.id)) { shopCat = it.cat; go('scrShop'); return; }
      G.equipItem(S, it.id); save(); renderWardrobe(); preview.update(S.equip);
    });
    preview.start(S.equip);
  }
  // 3D-превью регулировщика
  const preview = (() => {
    let r = null, scene, cam, model, raf = 0;
    function init() {
      const c = $('copPreview');
      r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(30, 1, 1, 1000); cam.position.set(0, 52, 150); cam.lookAt(0, 22, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9c907a, 1.2));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(60, 120, 80); scene.add(sun);
    }
    function update(eq) { if (!r) return; if (model) scene.remove(model); model = copModel(eq); scene.add(model); }
    function loop(t) {
      const c = $('copPreview'), w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * 2) { r.setPixelRatio(2); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      if (model) { model.rotation.y = t / 1600; model.userData.arm.rotation.x = -1.1 + Math.sin(t / 180) * .5; }
      r.render(scene, cam); raf = requestAnimationFrame(loop);
    }
    return {
      start(eq) { if (!r) init(); update(eq); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
      stop() { cancelAnimationFrame(raf); }, update,
    };
  })();

  /* =====================================================
     НАСТРОЙКИ И ПРОФИЛЬ
     ===================================================== */
  function renderSettings() {
    $$('input.sw').forEach(i => i.checked = !!S.settings[i.dataset.set]);
    $$('#quality button').forEach(b => b.classList.toggle('on', b.dataset.q === S.settings.quality));
    $('nameInput').value = S.profile.name;
  }
  $$('input.sw').forEach(i => i.addEventListener('change', () => { S.settings[i.dataset.set] = i.checked; settings[i.dataset.set] = i.checked; save(); }));
  $$('#quality button').forEach(b => b.onclick = () => { S.settings.quality = b.dataset.q; settings.quality = b.dataset.q; save(); renderSettings(); });
  $('nameInput').addEventListener('input', e => {
    const v = e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ0-9 ]/g, '').slice(0, 10);
    e.target.value = v; S.profile.name = v.trim() || 'ЖЕЗЛ 01'; save(); refresh();
  });
  $('btnReset').onclick = () => {
    openModal(`<h2>Сбросить прогресс?</h2><p>Наличные, звёзды, районы и вещи пропадут навсегда.</p>
      <div class="btns"><button class="btn red" id="rsYes">Да, сбросить</button><button class="btn white" id="rsNo">Отмена</button></div>`);
    $('rsNo').onclick = closeModal;
    $('rsYes').onclick = () => { resetSave(); location.reload(); };
  };
  function renderProfile() {
    const st = S.stats, rate = st.shifts ? Math.round(st.wins / st.shifts * 100) : 0;
    const ach = G.achievementProgress(S);
    $('profileBody').innerHTML = `
      <div class="card phero"><span class="speed">${S.profile.level}</span><div style="flex:1"><b>${S.profile.name}</b><small>${S.profile.xp} / ${xpNeed(S.profile.level)} XP до уровня ${S.profile.level + 1}</small><i class="bar" style="margin-top:6px"><u style="width:${S.profile.xp / xpNeed(S.profile.level) * 100}%"></u></i></div></div>
      <h3 class="sec">Статистика</h3>
      <div class="grid3">${[[st.shifts, 'смен'], [rate + '%', 'успешных'], [G.totalStars(S), 'звёзд'], [fmt(st.cars), 'машин'], [st.bus, 'автобусов'], [st.amb, 'скорых'], [st.crashes, 'аварий'], [st.cleanWins, 'без ошибок'], [Math.round(st.playTime / 60) + ' мин', 'в игре']].map(([v, l]) => `<div class="card stat"><b>${v}</b><small>${l}</small></div>`).join('')}</div>
      <h3 class="sec">Репутация районов</h3>
      <div class="card">${DISTRICTS.map(d => { const r = G.repInfo(S, d.id), open = G.unlockState(S, d.id).open;
        return `<div class="lrow ${open ? '' : 'off'}"><span class="ic">${d.icon}</span><div class="mid"><b>${d.name}</b><small>${open ? r.title : '🔒 закрыт'}${open && r.next ? ` · ${r.rep}/${r.next}` : ''}</small>${open ? `<i class="bar"><u style="width:${r.next ? (r.rep - r.prev) / (r.next - r.prev) * 100 : 100}%"></u></i>` : ''}</div><span class="rt">${open ? `♾️ ${S.records.endless[d.id] || 0}` : ''}</span></div>`; }).join('')}</div>
      <h3 class="sec">Достижения · ${ach.filter(a => a.done).length}/${ach.length}</h3>
      <div class="card">${ach.map(a => `<div class="lrow ${a.done ? '' : 'off'}"><span class="ic">${a.icon}</span><div class="mid"><b>${a.name}</b><small>${a.desc}</small>${a.done ? '' : `<i class="bar"><u style="width:${a.p / a.n * 100}%"></u></i>`}</div><span class="rt">${a.done ? '✓' : a.reward.cash ? '💵' + a.reward.cash : '⭐' + a.reward.tokens}</span></div>`).join('')}</div>
      <h3 class="sec">Испытания</h3>
      <div class="card">${CHALLENGES.map(c => `<div class="lrow ${S.rewards['ch:' + c.id] ? '' : 'off'}"><span class="ic">${c.icon}</span><div class="mid"><b>${c.name}</b><small>${S.rewards['ch:' + c.id] ? 'пройдено · рекорд ' + (S.records.challenges[c.id] || 0) : 'не пройдено'}</small></div></div>`).join('')}</div>`;
  }

  /* ---------- Android: назад и сворачивание ---------- */
  window.onAndroidBack = () => {
    if ($('scrGame').classList.contains('on')) { if (Shift.isRunning()) openPause(); else if ($('pRes')) $('pRes').click(); return true; }
    if ($('modal').classList.contains('on')) { if (!modalLock) closeModal(); return true; }
    if ($('sheet').classList.contains('on')) { closeSheet(); return true; }
    if (!$('scrMap').classList.contains('active')) { go('scrMap'); return true; }
    return false;
  };
  window.onAndroidPause = () => openPause();

  /* ---------- старт ---------- */
  buildCity(); renderCity(); refresh();
  requestAnimationFrame(() => {
    const nl = G.nextLevel(S), i = DISTRICTS.findIndex(d => d.id === nl.district);
    const sc = $('mapScroll'), h = $('city').getBoundingClientRect().height;
    sc.scrollTop = Math.max(0, MAP.rows[i] / MAP.h * h - sc.clientHeight / 2);
  });
  if (S.notices.length) {
    const n = S.notices.splice(0); save();
    openModal(`<h2>STOP! 3.0</h2>${n.map(t => `<p>${t}</p>`).join('')}<div class="btns"><button class="btn red" id="nOk">Понятно</button></div>`);
    $('nOk').onclick = closeModal;
  }
  // для отладки и автотестов
  window.__stop = { S: () => S, startShift: id => startShift(levelById(id) || G.endlessLevel(id)), save };
}
