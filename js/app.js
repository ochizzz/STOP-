/* ============ СТОП! — приложение: карта, вкладки, прогресс ============ */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const $$ = s => [...document.querySelectorAll(s)];
  const rndI = n => Math.floor(Math.random() * n);
  const pick = a => a[rndI(a.length)];
  const INK = '#1B1F3B';
  const COIN = '<span class="coin">₽</span>';
  const fmt = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  /* ---------- сохранение ---------- */
  const DEF = {
    coins: 200, xp: 0, lvl: 1, name: 'ЖЕЗЛ 01',
    inv: { evac: 0, siren: 0, donut: 0, kit: 0 },
    up: { zen: 0, patience: 0, bonus: 0 },
    owned: { hat: ['cap'], uniform: ['blue'], baton: ['classic'] },
    eq: { hat: 'cap', uniform: 'blue', baton: 'classic' },
    settings: { sound: true, vibro: true, effects: true, hints: true },
    missions: [], home: [1, 2],
    stats: { missions: 0, best: 0, cars: 0, crashes: 0, amb: 0, cortege: 0, shifts: 0 },
    daily: { day: '', prog: { cars: 0, missions: 0, amb: 0 }, claimed: {}, bonusDay: '', streak: 0 },
  };
  let P;
  function load() {
    let raw = null; try { raw = JSON.parse(localStorage.getItem('stop2') || 'null'); } catch (e) {}
    P = JSON.parse(JSON.stringify(DEF));
    if (raw) for (const k in raw) P[k] = (typeof DEF[k] === 'object' && !Array.isArray(DEF[k]) && DEF[k]) ? Object.assign(P[k], raw[k]) : raw[k];
  }
  function save() { try { localStorage.setItem('stop2', JSON.stringify(P)); } catch (e) {} }
  load();
  Object.assign(Game.settings, P.settings);

  /* ---------- значки-знаки ---------- */
  function warnSVG(inner = '!', w = 26, h = 24) {
    const t = /^[!0-9+]+$/.test(inner)
      ? `<text x="0" y="5" font-size="${inner.length > 1 ? 20 : 24}" font-weight="900" font-family="Rubik,sans-serif" fill="${INK}" text-anchor="middle" dominant-baseline="middle">${inner}</text>`
      : `<text x="0" y="5" font-size="20" text-anchor="middle" dominant-baseline="middle">${inner}</text>`;
    return `<svg viewBox="-31 -32 62 55" width="${w}" height="${h}"><polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/><polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="#FF3B30" stroke-width="7" stroke-linejoin="round"/>${t}</svg>`;
  }
  const triPip = on => `<svg viewBox="-28 -30 56 50"><polygon points="0,-22 22,14 -22,14" fill="${on ? '#FF3B30' : '#E3E8F3'}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></svg>`;

  /* ---------- общие окна ---------- */
  let toastT = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1500); }
  function openSheet(html) { $('sheet').innerHTML = '<div class="grab"></div>' + html; $('sheet').classList.add('on'); $('veil').classList.add('on'); }
  function closeSheet() { $('sheet').classList.remove('on'); if (!$('modal').classList.contains('on')) $('veil').classList.remove('on'); }
  let modalLock = false;
  function openModal(html, lock = false) { modalLock = lock; $('modal').innerHTML = html; $('modal').classList.add('on'); $('veil').classList.add('on'); }
  function closeModal() { const md = $('modal'); md.classList.remove('on'); modalLock = false; setTimeout(() => { if (!md.classList.contains('on')) md.innerHTML = ''; }, 200); if (!$('sheet').classList.contains('on')) $('veil').classList.remove('on'); }
  $('veil').addEventListener('click', () => { if (modalLock) return; closeSheet(); closeModal(); });
  document.addEventListener('click', e => { if (e.target.closest('button')) { Game.audio(); Game.sfx.tap(); } }, true);

  /* ---------- дата / ежедневка ---------- */
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function checkDay() {
    const t = dayKey();
    if (P.daily.day !== t) { P.daily.day = t; P.daily.prog = { cars: 0, missions: 0, amb: 0 }; P.daily.claimed = {}; save(); }
  }
  const bonusReady = () => P.daily.bonusDay !== dayKey();
  const dailyClaimable = () => DAILY.filter(q => !P.daily.claimed[q.id] && P.daily.prog[q.id] >= q.n).length;

  /* ---------- шапка / бейджи ---------- */
  function refresh() {
    checkDay();
    $$('.cAmount').forEach(e => e.textContent = fmt(P.coins));
    $('lvl').textContent = P.lvl;
    $('plateName').textContent = P.name; $('plateName2').textContent = P.name;
    $('rankName').textContent = rankFor(P.lvl);
    $('xpBar').style.width = Math.min(100, P.xp / xpNeed(P.lvl) * 100) + '%';
    const bb = $('btnBonus').querySelector('.badge'); bb.innerHTML = warnSVG('!'); bb.classList.toggle('on', bonusReady());
    const db = $('btnDaily').querySelector('.badge'); const dc = dailyClaimable(); db.innerHTML = warnSVG(String(dc || '!')); db.classList.toggle('on', dc > 0);
    const mc = $('mCount'); mc.innerHTML = warnSVG(String(P.missions.length)); mc.classList.toggle('on', P.missions.length > 0);
  }
  function addCoins(n) { P.coins += n; save(); refresh(); }
  function addXP(n) {
    P.xp += n; let up = 0;
    while (P.xp >= xpNeed(P.lvl)) { P.xp -= xpNeed(P.lvl); P.lvl++; up++; P.coins += 100; }
    save(); return up;
  }

  /* ---------- навигация ---------- */
  function go(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.scr === id));
    if (id === 'scrShop') renderShop();
    if (id === 'scrWardrobe') renderWardrobe();
    if (id === 'scrSettings') renderSettings();
    if (id === 'scrRating') renderRating();
    refresh();
  }
  $$('#nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.scr)));

  /* =====================================================
     КАРТА ГОРОДА
     ===================================================== */
  function seeded(seed) { let s = seed; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
  const BANDS = (() => {
    const { rows, river, road } = CITY, hr = road / 2;
    return [
      [0, rows[0] - hr, 'taxi'], [rows[0] + hr, rows[1] - hr, 'taxi'], [rows[1] + hr, rows[2] - hr, 'wedding'],
      [rows[2] + hr, river[0], 'wedding'], [river[1], rows[3] - hr, 'goose'], [rows[3] + hr, rows[4] - hr, 'goose'],
      [rows[4] + hr, rows[5] - hr, 'cow'], [rows[5] + hr, CITY.h, 'cow'],
    ];
  })();
  function buildCity() {
    const { w, h, cols, rows, river, road } = CITY, hr = road / 2;
    const rand = seeded(20261126);
    const xs = [[0, cols[0] - hr], [cols[0] + hr, cols[1] - hr], [cols[1] + hr, cols[2] - hr], [cols[2] + hr, w]];
    let s = `<defs>
      <pattern id="field" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="12" height="12" fill="#9BD85B"/><rect width="6" height="12" fill="#C9E86B"/></pattern>
    </defs>`;
    s += `<rect width="${w}" height="${h}" fill="#454C66"/>`;
    const landmarks = { taxi: '🚕', wedding: '💒', goose: '🎡', cow: '🐄' };
    const usedLm = {};
    for (const [y0, y1, th] of BANDS) {
      const T = THEMES[th];
      for (const [x0, x1] of xs) {
        const bx = x0 + 3, by = y0 + 3, bw = x1 - x0 - 6, bh = y1 - y0 - 6;
        if (bw < 20 || bh < 20) continue;
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="10" fill="${T.walk}" stroke="${INK}" stroke-width="2.5"/>`;
        const gx = bx + 6, gy = by + 6, gw = bw - 12, gh = bh - 12;
        if (th === 'cow' && rand() < .55) {
          s += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="7" fill="url(#field)"/>`;
        } else s += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="7" fill="${T.ground}"/>`;
        // содержимое
        if (th === 'goose' || (th === 'cow' && rand() < .4)) {
          const n = 2 + rndSeed(rand, 4);
          if (th === 'goose' && gw > 70 && gh > 40 && rand() < .5) s += `<ellipse cx="${gx + gw / 2}" cy="${gy + gh / 2}" rx="${gw / 4}" ry="${gh / 4}" fill="#38C6FF" stroke="${INK}" stroke-width="2.5"/>`;
          for (let i = 0; i < n; i++) {
            const tx = gx + 10 + rand() * (gw - 20), ty = gy + 10 + rand() * (gh - 20), tr = 7 + rand() * 5;
            s += `<circle cx="${tx + 3}" cy="${ty + 4}" r="${tr}" fill="rgba(27,31,59,.2)"/><circle cx="${tx}" cy="${ty}" r="${tr}" fill="#2FBF4A" stroke="${INK}" stroke-width="2"/><circle cx="${tx - tr * .3}" cy="${ty - tr * .3}" r="${tr * .4}" fill="#5CE06F"/>`;
          }
        } else if (th !== 'cow' || rand() < .5) {
          // крыши
          const parts = gw > gh ? Math.max(1, Math.round(gw / 60)) : Math.max(1, Math.round(gh / 60));
          for (let i = 0; i < parts; i++) {
            let rx, ry, rw, rh;
            if (gw > gh) { rw = gw / parts - 6; rh = gh - 10; rx = gx + 3 + i * gw / parts; ry = gy + 3; }
            else { rw = gw - 10; rh = gh / parts - 6; rx = gx + 3; ry = gy + 3 + i * gh / parts; }
            if (rw < 14 || rh < 14) continue;
            const c = T.roofs[rndSeed(rand, T.roofs.length)];
            s += `<rect x="${rx + 3}" y="${ry + 6}" width="${rw}" height="${rh}" rx="4" fill="rgba(27,31,59,.22)"/>`;
            s += `<rect x="${rx}" y="${ry + 4}" width="${rw}" height="${rh}" rx="4" fill="${shade(c, -.3)}" stroke="${INK}" stroke-width="2"/>`;
            s += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${c}" stroke="${INK}" stroke-width="2"/>`;
            if (rw > 24 && rh > 24 && rand() < .6) s += `<rect x="${rx + rw - 14}" y="${ry + 5}" width="9" height="8" rx="1.5" fill="#E6EAF2" stroke="${INK}" stroke-width="1.5"/>`;
          }
        } else {
          // амбар
          const bwid = Math.min(gw - 14, 50), bhei = Math.min(gh - 14, 34), ax = gx + (gw - bwid) / 2, ay = gy + (gh - bhei) / 2;
          s += `<rect x="${ax}" y="${ay + 4}" width="${bwid}" height="${bhei}" rx="3" fill="#A32A12" stroke="${INK}" stroke-width="2"/><rect x="${ax}" y="${ay}" width="${bwid}" height="${bhei}" rx="3" fill="#D84315" stroke="${INK}" stroke-width="2"/><line x1="${ax}" y1="${ay + bhei / 2}" x2="${ax + bwid}" y2="${ay + bhei / 2}" stroke="#fff" stroke-width="2"/>`;
        }
        if (!usedLm[th] && bw > 90 && bh > 70) { usedLm[th] = 1; s += `<text x="${bx + bw / 2}" y="${by + bh / 2 + 2}" font-size="30" text-anchor="middle" dominant-baseline="middle">${landmarks[th]}</text>`; }
      }
    }
    // река и мосты
    s += `<rect x="0" y="${river[0]}" width="${w}" height="${river[1] - river[0]}" fill="#38C6FF"/>`;
    s += `<line x1="0" y1="${river[0]}" x2="${w}" y2="${river[0]}" stroke="${INK}" stroke-width="3"/><line x1="0" y1="${river[1]}" x2="${w}" y2="${river[1]}" stroke="${INK}" stroke-width="3"/>`;
    for (let i = 0; i < 7; i++) { const x = 20 + i * 58, y = river[0] + 14 + (i % 2) * 22; s += `<path d="M${x} ${y} q6 -5 12 0 t12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".75"/>`; }
    for (const c of cols) {
      s += `<rect x="${c - hr - 3}" y="${river[0] - 4}" width="${road + 6}" height="${river[1] - river[0] + 8}" fill="#454C66" stroke="${INK}" stroke-width="2.5"/>`;
      s += `<line x1="${c - hr}" y1="${river[0] - 4}" x2="${c - hr}" y2="${river[1] + 4}" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/><line x1="${c + hr}" y1="${river[0] - 4}" x2="${c + hr}" y2="${river[1] + 4}" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/>`;
    }
    // осевые
    for (const c of cols) s += `<line x1="${c}" y1="0" x2="${c}" y2="${h}" stroke="#FFD60A" stroke-width="2.5" stroke-dasharray="9 9"/>`;
    for (const r of rows) s += `<line x1="0" y1="${r}" x2="${w}" y2="${r}" stroke="#FFD60A" stroke-width="2.5" stroke-dasharray="9 9"/>`;
    // перекрёстки
    for (const c of cols) for (const r of rows) s += `<rect x="${c - hr}" y="${r - hr}" width="${road}" height="${road}" fill="#4E5675"/><circle cx="${c}" cy="${r}" r="4" fill="#fff" opacity=".55"/>`;
    // подписи районов
    const labels = [[185, 'ЦЕНТР'], [335, 'СВАДЕБНЫЙ'], [675, 'ГУСИНЫЙ ПАРК'], [825, 'КОЛХОЗ «ЗАРЯ»']];
    for (const [y, t] of labels) s += `<text x="${(cols[0] + cols[1]) / 2}" y="${y}" font-family="Rubik,sans-serif" font-weight="900" font-size="13" letter-spacing="1" text-anchor="middle" dominant-baseline="middle" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke" stroke-linejoin="round">${t}</text>`;
    s += `<g id="mkLayer"></g>`;
    $('city').innerHTML = s;
  }
  function rndSeed(rand, n) { return Math.floor(rand() * n); }
  function shade(hex, p) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    if (p < 0) { r *= 1 + p; g *= 1 + p; b *= 1 + p; } else { r += (255 - r) * p; g += (255 - g) * p; b += (255 - b) * p; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /* ---------- задания на перекрёстках ---------- */
  const tplById = id => MISSIONS.find(m => m.id === id);
  const placeName = m => `${CITY.vStreets[m.ci]} × ${CITY.hStreets[m.ri]}`;
  function genMission() {
    const busy = new Set(P.missions.map(m => m.ci + ':' + m.ri)); busy.add(P.home.join(':'));
    const usedT = new Set(P.missions.map(m => m.tpl));
    let pool = MISSIONS.filter(t => !usedT.has(t.id)); if (!pool.length) pool = MISSIONS;
    for (let tries = 0; tries < 20; tries++) {
      const tpl = pick(pool);
      const nodes = [];
      for (let ci = 0; ci < 3; ci++) for (let ri = 0; ri < CITY.rows.length; ri++) {
        if (busy.has(ci + ':' + ri)) continue;
        if (tpl.theme && CITY.rowTheme[ri] !== tpl.theme) continue;
        nodes.push([ci, ri]);
      }
      if (!nodes.length) continue;
      const [ci, ri] = pick(nodes), base = DIFF_REWARD[tpl.diff];
      return { key: Date.now().toString(36) + rndI(1e6).toString(36), tpl: tpl.id, ci, ri, coins: base.coins + rndI(5) * 5, xp: base.xp };
    }
    return null;
  }
  function ensureMissions() {
    P.missions = P.missions.filter(m => tplById(m.tpl));
    while (P.missions.length < 5) { const m = genMission(); if (!m) break; P.missions.push(m); }
    save();
  }
  function renderMarkers() {
    const { cols, rows } = CITY;
    let s = '';
    const [hc, hrw] = P.home;
    s += `<g transform="translate(${cols[hc]},${rows[hrw]})"><circle r="15" fill="#2D7DFF" stroke="${INK}" stroke-width="3"/><text y="1" font-size="17" text-anchor="middle" dominant-baseline="middle">🚓</text></g>`;
    for (const m of P.missions) {
      const t = tplById(m.tpl), x = cols[m.ci], y = rows[m.ri];
      s += `<g class="mk" data-key="${m.key}" transform="translate(${x},${y - 20})"><g class="bob">
        <ellipse cx="0" cy="24" rx="16" ry="5" fill="rgba(27,31,59,.35)"/>
        <polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="${INK}" stroke-width="13" stroke-linejoin="round"/>
        <polygon points="0,-24 24,16 -24,16" fill="#fff" stroke="#FF3B30" stroke-width="7" stroke-linejoin="round"/>
        <text x="0" y="5" font-size="19" text-anchor="middle" dominant-baseline="middle">${t.icon}</text>
        <g transform="translate(0,31)"><rect x="-21" y="-9" width="42" height="18" rx="9" fill="#FFD60A" stroke="${INK}" stroke-width="2.5"/>
        <text x="0" y="1" font-family="Rubik,sans-serif" font-weight="900" font-size="11" text-anchor="middle" dominant-baseline="middle" fill="${INK}">₽${m.coins}</text></g>
      </g></g>`;
    }
    $('mkLayer').innerHTML = s;
  }
  $('city').addEventListener('click', e => {
    const g = e.target.closest('.mk'); if (!g) return;
    Game.audio(); Game.sfx.tap();
    const m = P.missions.find(x => x.key === g.dataset.key); if (m) openMission(m);
  });
  function boostLine() {
    const b = [['🏗️', 1 + P.inv.evac], ['🚨', 1 + P.inv.siren], ['🍩', P.inv.donut], ['❤️', 3 + (P.inv.kit > 0 ? 1 : 0)]];
    return `<div class="boosts">${b.map(([i, n]) => `<span>${i} ×${n}</span>`).join('')}</div>`;
  }
  function openMission(m) {
    const t = tplById(m.tpl), th = THEMES[t.theme || CITY.rowTheme[m.ri]];
    openSheet(`<div class="hazard"></div>
      <div class="mhead">${warnSVG(t.icon, 76, 70)}<div><h3>${t.title}</h3><div class="where">📍 ${placeName(m)} · ${th.icon} ${th.name}</div></div></div>
      <div class="mdesc">${t.desc}</div>
      <div class="mgoal"><span class="gi">${GOAL_ICON[t.goal.type]}</span>${GOAL_TEXT[t.goal.type](t.goal)}</div>
      <div class="mmeta">
        <div><small>Сложность</small><b class="tris">${[1, 2, 3].map(i => triPip(i <= t.diff)).join('')}</b></div>
        <div><small>Награда</small><b>${COIN}${m.coins}</b></div>
        <div><small>Опыт</small><b>⭐${m.xp}</b></div>
      </div>
      ${boostLine()}
      <button class="btn green wide" id="mGo">ЗАСТУПИТЬ НА СМЕНУ</button>`);
    $('mGo').onclick = () => { closeSheet(); launchMission(m); };
  }

  /* =====================================================
     ЗАПУСК ИГРЫ
     ===================================================== */
  const BASE = { evac: 1, siren: 1, donut: 0 };
  function launch(cfg, after) {
    const powers = { evac: BASE.evac + P.inv.evac, siren: BASE.siren + P.inv.siren, donut: BASE.donut + P.inv.donut };
    let lives = 3; if (P.inv.kit > 0) { P.inv.kit--; lives = 4; }
    save();
    $('scrGame').classList.add('on');
    const firstTime = P.settings.hints && P.stats.shifts < 2;
    requestAnimationFrame(() => Game.start(Object.assign({
      powers, lives, hints: firstTime,
      zenCD: 14 - 2 * P.up.zen, patience: 1 - .1 * P.up.patience, bonusEvery: 400 - 50 * P.up.bonus,
      cosmetics: P.eq,
      onEnd: res => {
        for (const k in BASE) P.inv[k] = Math.max(0, P.inv[k] - Math.max(0, res.used[k] - BASE[k]));
        P.stats.shifts++; P.stats.cars += res.stats.cars; P.stats.crashes += res.stats.crashes; P.stats.amb += res.stats.amb; P.stats.cortege += res.stats.cortege;
        checkDay(); P.daily.prog.cars += res.stats.cars; P.daily.prog.amb += res.stats.amb;
        save(); after(res);
      },
    }, cfg)));
  }
  function launchMission(m) {
    const t = tplById(m.tpl);
    launch({ theme: t.theme || CITY.rowTheme[m.ri], title: t.title, icon: t.icon, goal: t.goal, w: t.w, spawnMul: t.spawnMul, night: t.night },
      res => {
        if (res.win) {
          P.missions = P.missions.filter(x => x.key !== m.key);
          P.home = [m.ci, m.ri];
          P.stats.missions++; P.daily.prog.missions++;
          P.coins += m.coins; const up = addXP(m.xp);
          ensureMissions(); renderMarkers(); save(); refresh();
          resultWin(m, t, res, up);
        } else resultFail(res, () => launchMission(m));
      });
  }
  function launchShift(theme) {
    launch({ theme, title: 'Свободная смена', icon: THEMES[theme].icon, goal: null },
      res => {
        const coins = Math.floor(res.score / 8), best = res.score > P.stats.best;
        if (best) P.stats.best = res.score;
        P.coins += coins; const up = addXP(Math.floor(res.score / 20));
        save(); refresh();
        openModal(`<div class="hazard"></div><h2 class="chunk">СМЕНА ОКОНЧЕНА</h2><p>${res.reason}</p>
          <div class="bigscore">${res.score}</div><p>${best ? '🏆 Новый личный рекорд!' : 'Рекорд: ' + P.stats.best}</p>
          <div class="reward"><div><small>Штрафы собраны</small><b>${COIN}${coins}</b></div></div>
          ${up ? `<p>⬆️ Новое звание: <b>${rankFor(P.lvl)}</b> (+100 ₽)</p>` : ''}
          <div class="btns"><button class="btn green" id="rAgain">ЕЩЁ СМЕНУ</button><button class="btn white" id="rMap">НА КАРТУ</button></div>`, true);
        $('rAgain').onclick = () => { closeModal(); launchShift(theme); };
        $('rMap').onclick = backToMap;
      });
  }
  function backToMap() { closeModal(); Game.quit(); $('scrGame').classList.remove('on'); go('scrMap'); }
  function resultWin(m, t, res, up) {
    openModal(`<div class="hazard"></div><h2 class="chunk">ЗАДАНИЕ<br>ВЫПОЛНЕНО!</h2>
      <p>${t.icon} ${t.title} · ${placeName(m)}</p>
      <div class="reward"><div><small>Награда</small><b>${COIN}${m.coins}</b></div><div><small>Опыт</small><b>⭐${m.xp}</b></div></div>
      ${up ? `<p>⬆️ Новое звание: <b>${rankFor(P.lvl)}</b> (+100 ₽)</p>` : ''}
      <div class="btns"><button class="btn green" id="rMap">НА КАРТУ</button></div>`, true);
    Game.sfx.coin();
    $('rMap').onclick = backToMap;
  }
  function resultFail(res, retry) {
    openModal(`<div class="hazard"></div><h2 class="chunk" style="color:#FF3B30">УВОЛЕН!</h2><p>${res.reason}</p>
      <div class="bigscore">${res.score}</div><p>очков за смену</p>
      <div class="btns"><button class="btn" id="rAgain">ЕЩЁ РАЗ</button><button class="btn white" id="rMap">НА КАРТУ</button></div>`, true);
    $('rAgain').onclick = () => { closeModal(); retry(); };
    $('rMap').onclick = backToMap;
  }
  // пауза
  function openPause() {
    if (!Game.isRunning()) return;
    Game.pause();
    openModal(`<div class="hazard"></div><h2 class="chunk">ПЕРЕКУР</h2><p>Водители ждут и злятся…</p>
      <div class="btns"><button class="btn green" id="pRes">ПРОДОЛЖИТЬ</button><button class="btn red" id="pQuit">СДАТЬ СМЕНУ</button></div>`, true);
    $('pRes').onclick = () => { closeModal(); Game.resume(); };
    $('pQuit').onclick = backToMap;
  }
  $('gPause').addEventListener('click', openPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) openPause(); });

  /* =====================================================
     БОКОВЫЕ КНОПКИ
     ===================================================== */
  $('btnBonus').onclick = () => {
    const ready = bonusReady();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = ready ? (P.daily.bonusDay === dayKey(y) ? P.daily.streak + 1 : 1) : P.daily.streak;
    const amount = 50 + 25 * Math.min(streak, 7);
    openModal(`<div class="hazard"></div><h2 class="chunk">ПРЕМИЯ</h2>
      <p>${ready ? 'Начальство довольно. Забирай премию!' : 'Сегодня уже получено. Приходи завтра.'}</p>
      <div class="reward"><div><small>День подряд</small><b>🔥${streak}</b></div><div><small>Сумма</small><b>${COIN}${amount}</b></div></div>
      <div class="btns">${ready ? '<button class="btn green" id="bClaim">ЗАБРАТЬ</button>' : ''}<button class="btn white" id="bClose">ЗАКРЫТЬ</button></div>`);
    $('bClose').onclick = closeModal;
    if (ready) $('bClaim').onclick = () => { P.daily.bonusDay = dayKey(); P.daily.streak = streak; addCoins(amount); Game.sfx.coin(); toast(`+${amount} ₽`); closeModal(); };
  };
  function openDaily() {
    checkDay();
    openModal(`<div class="hazard"></div><h2 class="chunk">ЗАДАНИЯ ДНЯ</h2><p>Обновляются каждый день</p>
      <div class="dlist">${DAILY.map(q => {
        const p = Math.min(q.n, P.daily.prog[q.id] || 0), done = p >= q.n, got = P.daily.claimed[q.id];
        return `<div class="drow"><span class="ic">${q.icon}</span><div class="mid"><b>${q.text}</b><div class="bar"><i style="width:${p / q.n * 100}%"></i></div></div>
          ${got ? '<b>✅</b>' : `<button class="btn ${done ? 'green' : 'white'}" data-q="${q.id}" ${done ? '' : 'disabled'}>${done ? 'ЗАБРАТЬ' : p + '/' + q.n}</button>`}</div>`;
      }).join('')}</div>
      <div class="btns"><button class="btn white" id="dClose">ЗАКРЫТЬ</button></div>`);
    $('dClose').onclick = closeModal;
    $$('#modal [data-q]').forEach(b => b.onclick = () => {
      const q = DAILY.find(x => x.id === b.dataset.q); P.daily.claimed[q.id] = true; addCoins(q.reward); Game.sfx.coin(); toast(`+${q.reward} ₽`); openDaily();
    });
  }
  $('btnDaily').onclick = openDaily;
  $('btnShift').onclick = () => {
    openModal(`<div class="hazard"></div><h2 class="chunk">СВОБОДНАЯ СМЕНА</h2><p>Бесконечный режим. Держись, сколько сможешь.<br>Рекорд: <b>${P.stats.best}</b></p>
      <div class="districts">${Object.entries(THEMES).map(([k, t]) => `<button data-th="${k}" style="background:${t.ground}"><span>${t.icon}</span>${t.name}</button>`).join('')}</div>
      <div class="btns"><button class="btn white" id="sClose">ЗАКРЫТЬ</button></div>`);
    $('sClose').onclick = closeModal;
    $$('#modal [data-th]').forEach(b => b.onclick = () => { closeModal(); launchShift(b.dataset.th); });
  };
  $('btnRadio').onclick = () => {
    const msgs = [...RADIO].sort(() => Math.random() - .5).slice(0, 3);
    openModal(`<div class="hazard"></div><h2 class="chunk">РАЦИЯ</h2>
      <div class="radio">${msgs.map(m => `<p>📡 ${m}</p>`).join('')}</div>
      <div class="btns"><button class="btn blue" id="rNew">НОВЫЕ ВЫЗОВЫ · ${COIN}50</button><button class="btn white" id="rClose">ЗАКРЫТЬ</button></div>`);
    $('rClose').onclick = closeModal;
    $('rNew').onclick = () => {
      if (P.coins < 50) { toast('Не хватает штрафов'); return; }
      P.coins -= 50; P.missions = []; ensureMissions(); renderMarkers(); refresh(); closeModal(); toast('📻 Новые вызовы на карте');
    };
  };

  /* =====================================================
     МАГАЗИН
     ===================================================== */
  function renderShop() {
    $('shopBoost').innerHTML = BOOSTERS.map(b => `<div class="card item"><span class="own">×${P.inv[b.id]}</span><span class="big">${b.icon}</span><b>${b.name}</b><small>${b.desc}</small>
      <button class="btn price" data-buy="${b.id}" ${P.coins < b.price ? 'disabled' : ''}>${COIN}${b.price}</button></div>`).join('');
    $('shopUp').innerHTML = UPGRADES.map(u => {
      const l = P.up[u.id], max = l >= u.prices.length;
      return `<div class="card urow"><span class="big">${u.icon}</span><div class="mid"><b>${u.name}</b><small>${u.desc} · сейчас ${u.fx(l)}</small>
        <div class="pips">${u.prices.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
        ${max ? '<b>МАКС</b>' : `<button class="btn" data-up="${u.id}" ${P.coins < u.prices[l] ? 'disabled' : ''}>${COIN}${u.prices[l]}</button>`}</div>`;
    }).join('');
    $('shopChest').innerHTML = `<div class="card chest"><span class="big">🎁</span><div class="mid"><b>Конфискат</b><small>Случайная вещь из гардероба. Изъято у нарушителей.</small></div>
      <button class="btn" id="buyChest" ${P.coins < CHEST_PRICE ? 'disabled' : ''}>${COIN}${CHEST_PRICE}</button></div>`;
    $$('#shopBoost [data-buy]').forEach(b => b.onclick = () => {
      const it = BOOSTERS.find(x => x.id === b.dataset.buy); if (P.coins < it.price) return;
      P.coins -= it.price; P.inv[it.id]++; save(); Game.sfx.coin(); toast(`${it.icon} Куплено!`); renderShop(); refresh();
    });
    $$('#shopUp [data-up]').forEach(b => b.onclick = () => {
      const u = UPGRADES.find(x => x.id === b.dataset.up), price = u.prices[P.up[u.id]]; if (P.coins < price) return;
      P.coins -= price; P.up[u.id]++; save(); Game.sfx.ding(); toast(`${u.icon} Улучшено!`); renderShop(); refresh();
    });
    $('buyChest').onclick = () => {
      const pool = [];
      for (const cat in WARDROBE) for (const it of WARDROBE[cat]) if (!P.owned[cat].includes(it.id)) pool.push([cat, it]);
      if (!pool.length) { toast('Ты уже всё конфисковал'); return; }
      if (P.coins < CHEST_PRICE) return;
      P.coins -= CHEST_PRICE; const [cat, it] = pick(pool); P.owned[cat].push(it.id); save(); refresh(); renderShop(); Game.sfx.win();
      openModal(`<div class="hazard"></div><h2 class="chunk">КОНФИСКОВАНО!</h2>
        <div style="display:flex;justify-content:center;margin:8px 0">${itemSwatch(cat, it, 96)}</div>
        <p><b>${it.name}</b> · ${({ hat: 'шапка', uniform: 'форма', baton: 'жезл' })[cat]}</p>
        <div class="btns"><button class="btn green" id="cWear">НАДЕТЬ</button><button class="btn white" id="cClose">ПОТОМ</button></div>`);
      $('cWear').onclick = () => { P.eq[cat] = it.id; save(); closeModal(); go('scrWardrobe'); };
      $('cClose').onclick = closeModal;
    };
  }

  /* =====================================================
     ГАРДЕРОБ
     ===================================================== */
  let wCat = 'hat', tryOn = null;
  function batonSVG(b, s = 1) {
    const glow = b.glow ? `style="filter:drop-shadow(0 0 6px ${b.glow})"` : '';
    const tip = b.tip ? `<text x="64" y="1" font-size="20" text-anchor="middle" dominant-baseline="middle" transform="rotate(90 64 1)">${b.tip}</text>` : '';
    return `<g ${glow}><rect x="0" y="-6" width="58" height="12" rx="6" fill="${b.main}" stroke="${INK}" stroke-width="3.5"/>
      <rect x="20" y="-4.2" width="8" height="8.4" fill="${b.stripe}"/><rect x="38" y="-4.2" width="8" height="8.4" fill="${b.stripe}"/>${tip}</g>`;
  }
  function hatSVG(id) {
    const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
    switch (id) {
      case 'ushanka': return `<rect x="54" y="62" width="20" height="40" rx="9" fill="#8D5A3B" ${S}/><rect x="126" y="62" width="20" height="40" rx="9" fill="#8D5A3B" ${S}/>
        <path d="M60 66 Q60 30 100 30 Q140 30 140 66 Z" fill="#8D5A3B" ${S}/><rect x="60" y="54" width="80" height="18" rx="9" fill="#C9A27E" ${S}/><circle cx="100" cy="46" r="5" fill="#FF3B30" stroke="${INK}" stroke-width="2.5"/>`;
      case 'cowboy': return `<ellipse cx="100" cy="62" rx="64" ry="13" fill="#B9733A" ${S}/><path d="M72 62 L78 24 Q100 32 122 24 L128 62 Z" fill="#C98445" ${S}/>
        <rect x="74" y="50" width="52" height="9" fill="#6B3E1A"/><polygon points="100,46 103,52 110,53 105,57 106,63 100,60 94,63 95,57 90,53 97,52" fill="#FFD60A" stroke="${INK}" stroke-width="1.5"/>`;
      case 'hardhat': return `<path d="M62 66 Q62 22 100 22 Q138 22 138 66 Z" fill="#FFD60A" ${S}/><rect x="52" y="60" width="96" height="12" rx="6" fill="#FFC400" ${S}/><rect x="94" y="22" width="12" height="40" rx="5" fill="#E0B000"/>`;
      case 'crown': return `<polygon points="62,68 62,30 80,48 100,18 120,48 138,30 138,68" fill="#FFC400" ${S}/><circle cx="100" cy="54" r="6" fill="#FF3B30" stroke="${INK}" stroke-width="2.5"/>
        <circle cx="78" cy="58" r="4" fill="#2D7DFF" stroke="${INK}" stroke-width="2"/><circle cx="122" cy="58" r="4" fill="#3DDC5C" stroke="${INK}" stroke-width="2"/>`;
      case 'cone': return `<rect x="62" y="58" width="76" height="14" rx="5" fill="#E55A00" ${S}/><polygon points="74,62 100,0 126,62" fill="#FF7A1A" ${S}/>
        <polygon points="85,36 115,36 120,48 80,48" fill="#fff"/><polygon points="93,16 107,16 110,24 90,24" fill="#fff"/>`;
      default: return `<path d="M60 64 Q58 26 100 24 Q142 26 140 64 Z" fill="#23409E" ${S}/><path d="M62 62 Q100 78 138 62 L140 72 Q100 92 60 72 Z" fill="${INK}"/>
        <rect x="62" y="56" width="76" height="9" fill="#14264F"/><circle cx="100" cy="44" r="8" fill="#FFD60A" stroke="${INK}" stroke-width="3"/>`;
    }
  }
  function copSVG(eq) {
    const uni = (WARDROBE.uniform.find(u => u.id === eq.uniform) || WARDROBE.uniform[0]).color;
    const bat = WARDROBE.baton.find(b => b.id === eq.baton) || WARDROBE.baton[0];
    const dark = shade(uni, -.28), SK = '#F6C9A0';
    return `<svg viewBox="0 -10 200 240">
      <ellipse cx="100" cy="222" rx="54" ry="9" fill="rgba(27,31,59,.3)"/>
      <rect x="76" y="168" width="20" height="46" rx="8" fill="#2A2E3F" stroke="${INK}" stroke-width="4"/><rect x="104" y="168" width="20" height="46" rx="8" fill="#2A2E3F" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="84" cy="216" rx="15" ry="7" fill="${INK}"/><ellipse cx="116" cy="216" rx="15" ry="7" fill="${INK}"/>
      <line x1="68" y1="118" x2="56" y2="160" stroke="${INK}" stroke-width="26" stroke-linecap="round"/><line x1="68" y1="118" x2="56" y2="160" stroke="${dark}" stroke-width="18" stroke-linecap="round"/>
      <circle cx="55" cy="164" r="10" fill="${SK}" stroke="${INK}" stroke-width="3.5"/>
      <rect x="62" y="106" width="76" height="72" rx="24" fill="${uni}" stroke="${INK}" stroke-width="4"/>
      <path d="M64 130 Q64 108 86 106 L86 176 Q64 176 64 150 Z" fill="${dark}" opacity=".5"/>
      <rect x="63" y="152" width="74" height="10" fill="${INK}"/><rect x="94" y="151" width="12" height="12" rx="2" fill="#FFD60A" stroke="${INK}" stroke-width="2"/>
      <polygon points="116,118 119,125 127,126 121,131 123,139 116,135 109,139 111,131 105,126 113,125" fill="#FFD60A" stroke="${INK}" stroke-width="2"/>
      <polygon points="92,106 108,106 100,124" fill="#FF3B30" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <g transform="translate(150,96) rotate(-64)">${batonSVG(bat)}</g>
      <line x1="132" y1="116" x2="150" y2="96" stroke="${INK}" stroke-width="26" stroke-linecap="round"/><line x1="132" y1="116" x2="150" y2="96" stroke="${uni}" stroke-width="18" stroke-linecap="round"/>
      <circle cx="152" cy="93" r="10" fill="${SK}" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="66" cy="78" r="9" fill="${SK}" stroke="${INK}" stroke-width="3.5"/><circle cx="134" cy="78" r="9" fill="${SK}" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="100" cy="76" r="35" fill="${SK}" stroke="${INK}" stroke-width="4"/>
      <circle cx="80" cy="90" r="6" fill="#FF9AA2" opacity=".6"/><circle cx="120" cy="90" r="6" fill="#FF9AA2" opacity=".6"/>
      <ellipse cx="88" cy="76" rx="4.5" ry="6" fill="${INK}"/><ellipse cx="112" cy="76" rx="4.5" ry="6" fill="${INK}"/>
      <circle cx="89.5" cy="73.5" r="1.6" fill="#fff"/><circle cx="113.5" cy="73.5" r="1.6" fill="#fff"/>
      <circle cx="100" cy="86" r="5" fill="#EBA57E" stroke="${INK}" stroke-width="2"/>
      <path d="M78 96 Q88 88 100 94 Q112 88 122 96 Q112 102 100 97 Q88 102 78 96 Z" fill="#5A3A22" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      ${hatSVG(eq.hat)}
    </svg>`;
  }
  function itemSwatch(cat, it, size = 44) {
    if (cat === 'uniform') return `<span class="sw" style="width:${size}px;height:${size}px;background:${it.color}"></span>`;
    if (cat === 'hat') return `<span class="sw" style="width:${size}px;height:${size}px;background:#EEF4FF;font-size:${size * .6}px">${it.icon}</span>`;
    return `<span class="sw" style="width:${size}px;height:${size}px;background:#EEF4FF"><svg viewBox="-6 -40 76 80" width="${size * .8}" height="${size * .8}"><g transform="rotate(-45 32 0)">${batonSVG(it)}</g></svg></span>`;
  }
  function renderWardrobe() {
    const eq = Object.assign({}, P.eq); if (tryOn) eq[tryOn.cat] = tryOn.id;
    $('copPreview').innerHTML = copSVG(eq);
    $$('#wTabs button').forEach(b => b.classList.toggle('on', b.dataset.cat === wCat));
    const items = WARDROBE[wCat];
    $('wItems').innerHTML = items.map(it => {
      const own = P.owned[wCat].includes(it.id), on = P.eq[wCat] === it.id, sel = eq[wCat] === it.id;
      const tag = on ? '<span class="tag eq">✓ Надето</span>' : own ? '<span class="tag">Надеть</span>' : `<span class="tag">${COIN}${it.price}</span>`;
      return `<button class="witem ${sel ? 'sel' : ''} ${own ? '' : 'lock'}" data-id="${it.id}">${itemSwatch(wCat, it)}<b>${it.name}</b>${tag}</button>`;
    }).join('') + '';
    let act = '';
    if (tryOn && tryOn.cat === wCat && !P.owned[wCat].includes(tryOn.id)) {
      const it = items.find(x => x.id === tryOn.id);
      act = `<button class="btn green wide" id="wBuy" ${P.coins < it.price ? 'disabled' : ''}>КУПИТЬ «${it.name}» · ${COIN}${it.price}</button>`;
    }
    let ab = $('wAction'); if (!ab) { ab = document.createElement('div'); ab.id = 'wAction'; $('wItems').after(ab); }
    ab.innerHTML = act;
    $$('#wItems .witem').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (P.owned[wCat].includes(id)) { P.eq[wCat] = id; tryOn = null; save(); }
      else tryOn = { cat: wCat, id };
      renderWardrobe();
    });
    const wb = $('wBuy');
    if (wb) wb.onclick = () => {
      const it = items.find(x => x.id === tryOn.id); if (P.coins < it.price) return;
      P.coins -= it.price; P.owned[wCat].push(it.id); P.eq[wCat] = it.id; tryOn = null; save(); refresh(); Game.sfx.coin(); toast('Обновка!'); renderWardrobe();
    };
  }
  $$('#wTabs button').forEach(b => b.addEventListener('click', () => { wCat = b.dataset.cat; tryOn = null; renderWardrobe(); }));

  /* =====================================================
     НАСТРОЙКИ
     ===================================================== */
  function renderSettings() {
    $$('input.sw').forEach(i => i.checked = !!P.settings[i.dataset.set]);
    $('nameInput').value = P.name;
  }
  $$('input.sw').forEach(i => i.addEventListener('change', () => {
    P.settings[i.dataset.set] = i.checked; Game.settings[i.dataset.set] = i.checked; save();
    if (i.checked) { Game.audio(); Game.sfx.tap(); }
  }));
  $('nameInput').addEventListener('input', e => {
    const v = e.target.value.toUpperCase().replace(/[^A-ZА-ЯЁ0-9 ]/g, '').slice(0, 10);
    e.target.value = v; P.name = v.trim() || 'ЖЕЗЛ 01'; save(); refresh();
  });
  $('btnReset').onclick = () => {
    openModal(`<div class="hazard"></div><h2 class="chunk" style="color:#FF3B30">СБРОСИТЬ?</h2><p>Штрафы, звания, вещи и задания пропадут навсегда.</p>
      <div class="btns"><button class="btn red" id="rsYes">ДА, СБРОСИТЬ</button><button class="btn white" id="rsNo">ОТМЕНА</button></div>`);
    $('rsNo').onclick = closeModal;
    $('rsYes').onclick = () => { try { localStorage.removeItem('stop2'); } catch (e) {} location.reload(); };
  };

  /* =====================================================
     РЕЙТИНГ
     ===================================================== */
  const NPC = [['Дядя Стёпа', 2400], ['Гусь Валера', 1850], ['Таксист Ашот', 1600], ['Бабушка с пончиком', 1300], ['Клоун Кеша', 950], ['Корова Зорька', 700], ['Стажёр Петя', 420], ['Тракторист Михалыч', 260]];
  function renderRating() {
    const st = P.stats;
    const cards = [['🎖️', P.lvl, rankFor(P.lvl)], ['⚠️', st.missions, 'заданий выполнено'], ['🏆', st.best, 'лучшая смена'], ['🚗', fmt(st.cars), 'машин пропущено'],
      ['🚑', st.amb, 'скорых спасено'], ['💒', st.cortege, 'кортежей целыми'], ['💥', st.crashes, 'ДТП допущено'], ['🕒', st.shifts, 'смен отработано']];
    $('statCards').innerHTML = cards.map(([i, v, l]) => `<div class="card stat"><div class="big">${i}</div><b>${v}</b><small>${l}</small></div>`).join('');
    const rows = NPC.map(([n, s]) => ({ n, s })); rows.push({ n: P.name + ' (ты)', s: st.best, me: true });
    rows.sort((a, b) => b.s - a.s);
    $('board').innerHTML = rows.map((r, i) => `<div class="card brow ${r.me ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nm">${r.n}</span><span class="sc">${fmt(r.s)}</span></div>`).join('');
  }

  /* ---------- старт ---------- */
  Game.init();
  buildCity(); ensureMissions(); renderMarkers(); refresh();
  requestAnimationFrame(() => {
    const sc = $('mapScroll'), svgH = $('city').getBoundingClientRect().height;
    sc.scrollTop = Math.max(0, CITY.rows[P.home[1]] / CITY.h * svgH - sc.clientHeight / 2);
  });
})();
