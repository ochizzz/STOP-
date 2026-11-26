/* ============ СТОП! — движок перекрёстка ============ */
'use strict';
const Game = (() => {
  const W = 490, R = 66, LANE = 33, OFF = 90, BR = 320, AC = 190;
  const INK = '#1B1F3B', SHADOW = 'rgba(27,31,59,.22)';
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const FONT = '"Rubik",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
  let H = 820, C = { x: 245, y: 420 }, LANES = [];
  let cv, ctx, stage, o, theme, weights, S = null, raf = 0, last = 0, running = false, paused = false;
  const $ = id => document.getElementById(id);
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  function pickW(w) { let s = 0; for (const k in w) s += w[k]; let r = Math.random() * s; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return 'car'; }

  /* ---------- звук (общий с меню) ---------- */
  const settings = { sound: true, vibro: true, effects: true, hints: true };
  let ac = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); }
  function tone(f, d, type = 'square', vol = .05, slide = 0) {
    if (!settings.sound || !ac) return;
    const t = ac.currentTime, os = ac.createOscillator(), g = ac.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t);
    if (slide) os.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t + d);
  }
  const sfx = {
    tap() { tone(660, .05, 'triangle', .04, 200); },
    honk() { tone(310, .16, 'square', .03); setTimeout(() => tone(260, .2, 'square', .03), 90); },
    whistle() { tone(1800, .12, 'sine', .05, 600); },
    crash() { tone(140, .4, 'sawtooth', .09, -100); tone(70, .5, 'square', .08, -30); },
    ding() { tone(880, .1, 'triangle', .05); setTimeout(() => tone(1320, .15, 'triangle', .05), 80); },
    coin() { tone(1200, .07, 'square', .03); setTimeout(() => tone(1800, .1, 'square', .03), 60); },
    hurt() { tone(300, .3, 'sawtooth', .07, -220); },
    siren() { tone(700, .3, 'sine', .06, 500); setTimeout(() => tone(1200, .3, 'sine', .06, -500), 300); },
    pop() { tone(500, .08, 'triangle', .05, 300); },
    win() { [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, .14, 'triangle', .06), i * 90)); },
  };
  const buzz = ms => { if (settings.vibro && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };

  /* ---------- геометрия ---------- */
  function layout() {
    const r = stage.getBoundingClientRect();
    const asp = (r.width > 0 && r.height > 0) ? r.height / r.width : 1.6;
    H = Math.round(Math.min(1100, Math.max(600, W * asp)));
    C = { x: W / 2, y: Math.round(H / 2) + 14 };
    LANES = [
      { axis: 0, dx: 0, dy: 1, x: C.x - LANE, y: -OFF },
      { axis: 0, dx: 0, dy: -1, x: C.x + LANE, y: H + OFF },
      { axis: 1, dx: 1, dy: 0, x: -OFF, y: C.y + LANE },
      { axis: 1, dx: -1, dy: 0, x: W + OFF, y: C.y - LANE },
    ];
    for (const L of LANES) {
      L.ang = Math.atan2(L.dy, L.dx);
      L.centerT = (C.x - L.x) * L.dx + (C.y - L.y) * L.dy;
      L.stopT = L.centerT - R - 24;
      L.boxEndT = L.centerT + R;
      L.total = (L.dx ? W : H) + OFF * 2;
    }
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr); cv.height = Math.floor(H * s * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  }

  /* ---------- декор: крыши домов и парки ---------- */
  function seeded(seed) { let s = seed % 2147483647 || 7; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
  function buildDeco() {
    const rand = seeded(Math.floor(Math.random() * 1e6) + 1);
    const lots = [];
    const blocks = [[-30, -30, C.x - R - 10, C.y - R - 10], [C.x + R + 10, -30, W + 30, C.y - R - 10], [-30, C.y + R + 10, C.x - R - 10, H + 30], [C.x + R + 10, C.y + R + 10, W + 30, H + 30]];
    const split = (x0, y0, x1, y1, d) => {
      const w = x1 - x0, h = y1 - y0;
      if (d > 4 || (w < 150 && h < 150)) { lots.push([x0, y0, x1, y1]); return; }
      if (w > h) { const m = x0 + w * (.38 + rand() * .24); split(x0, y0, m, y1, d + 1); split(m, y0, x1, y1, d + 1); }
      else { const m = y0 + h * (.38 + rand() * .24); split(x0, y0, x1, m, d + 1); split(x0, m, x1, y1, d + 1); }
    };
    for (const b of blocks) split(b[0] + 22, b[1] + 22, b[2] - 22, b[3] - 22, 0);
    const deco = [];
    let emo = 0;
    for (const [x0, y0, x1, y1] of lots) {
      const w = x1 - x0 - 12, h = y1 - y0 - 12; if (w < 24 || h < 24) continue;
      if (rand() < theme.trees) {
        const n = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) deco.push({ k: 'tree', x: x0 + 18 + rand() * (w - 12), y: y0 + 18 + rand() * (h - 12), s: 11 + rand() * 7 });
      } else {
        deco.push({ k: 'roof', x: x0 + 6, y: y0 + 6, w, h, c: theme.roofs[Math.floor(rand() * theme.roofs.length)], ac: rand() < .6, tank: rand() < .3 });
        if (emo < 3 && rand() < .25 && w > 50 && h > 50) { emo++; deco.push({ k: 'emoji', x: x0 + 6 + w / 2, y: y0 + 6 + h / 2, e: pick(theme.deco) }); }
      }
    }
    deco.sort((a, b) => a.y - b.y);
    return deco;
  }

  /* ---------- старт ---------- */
  function init() {
    cv = $('gCanvas'); ctx = cv.getContext('2d'); stage = $('gStage');
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); audio();
      if (!running || paused) return;
      const r = cv.getBoundingClientRect();
      tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    $('pwZen').addEventListener('click', () => setMode('zen'));
    $('pwEvac').addEventListener('click', () => setMode('evac'));
    $('pwSiren').addEventListener('click', useSiren);
    $('pwDonut').addEventListener('click', useDonut);
    window.addEventListener('resize', () => { if (running) fit(); });
    window.addEventListener('keydown', e => {
      if (!running || paused) return;
      const k = e.key; let ax = null;
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'w' || k === 's') ax = 0;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') ax = 1;
      if (k === ' ') ax = 1 - S.green;
      if (ax !== null) setAxis(ax);
    });
  }

  function start(opts) {
    o = opts; theme = THEMES[o.theme] || THEMES.wedding;
    weights = Object.assign({}, DISTRICT_W[o.theme] || DISTRICT_W.wedding, o.w || {});
    layout(); fit();
    S = {
      cars: [], fx: [], texts: [], deco: buildDeco(), uid: 0, time: 0, score: 0,
      lives: o.lives || 3, maxLives: o.lives || 3, green: 0, spawnT: .5, frozen: 0, shake: 0, copHurt: 0,
      zenCD: 0, zenMax: o.zenCD || 14, mode: null,
      powers: Object.assign({ evac: 0, siren: 0, donut: 0 }, o.powers), used: { evac: 0, siren: 0, donut: 0 },
      bonusEvery: o.bonusEvery || 400, nextBonus: o.bonusEvery || 400,
      patience: o.patience || 1, spawnMul: o.spawnMul || 1,
      bannerText: '', bannerT: 0, copAng: -Math.PI / 2, tutorial: o.hints ? 1 : 0, ringPulse: 0, over: false,
      stats: { cars: 0, amb: 0, cortege: 0, cow: 0, taxi: 0, crashes: 0 },
    };
    stage.style.background = theme.road;
    banner((o.icon || theme.icon) + ' ' + o.title + '\n' + (o.goal ? GOAL_TEXT[o.goal.type](o.goal) : 'Свободная смена. Держись сколько сможешь'), 2600);
    running = true; paused = false; hudCache = '';
    updateHud();
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function pause() { if (running) paused = true; }
  function resume() { if (running) { paused = false; last = performance.now(); } }
  function quit() { running = false; cancelAnimationFrame(raf); }
  function isRunning() { return running && !paused && S && !S.over; }

  /* ---------- цели задания ---------- */
  function progress() {
    const g = o.goal; if (!g) return null;
    const st = S.stats;
    const cur = { survive: S.time, score: S.score, cars: st.cars, amb: st.amb, cortege: st.cortege, cow: st.cow }[g.type];
    const need = g.type === 'survive' ? g.t : g.n;
    return { cur: Math.min(cur, need), need, done: cur >= need };
  }
  function finish(win, reason) {
    if (S.over) return; S.over = true; S.mode = null;
    if (win) { sfx.win(); burst(C.x, C.y, '🎉', 4); burst(C.x, C.y, '⭐', 3); }
    const res = { win, reason, score: Math.floor(S.score), time: S.time, stats: S.stats, used: S.used };
    setTimeout(() => { running = false; cancelAnimationFrame(raf); o.onEnd && o.onEnd(res); }, win ? 700 : 1000);
  }

  /* ---------- HUD ---------- */
  let hudCache = '';
  function updateHud() {
    const p = progress();
    const key = [S.lives, Math.floor(S.score), S.powers.evac, S.powers.siren, S.powers.donut, S.mode, Math.ceil(S.zenCD * 4), p ? Math.floor(p.cur) : -1].join('|');
    if (key === hudCache) return; hudCache = key;
    $('gHearts').innerHTML = '<i>❤️</i>'.repeat(Math.max(0, S.lives)) + '<i class="lost">❤️</i>'.repeat(Math.max(0, S.maxLives - S.lives));
    $('gScore').textContent = Math.floor(S.score);
    const gc = $('gGoal');
    if (p) {
      gc.style.display = '';
      const g = o.goal;
      const val = g.type === 'survive' ? `${Math.max(0, Math.ceil(p.need - p.cur))} сек` : `${Math.floor(p.cur)}/${p.need}`;
      gc.querySelector('b').textContent = GOAL_ICON[g.type] + ' ' + val;
      gc.querySelector('.bar i').style.width = (p.cur / p.need * 100) + '%';
    } else gc.style.display = 'none';
    for (const k of ['evac', 'siren', 'donut']) {
      const b = $('pw' + k[0].toUpperCase() + k.slice(1));
      b.querySelector('.n').textContent = S.powers[k];
      b.classList.toggle('off', S.powers[k] <= 0);
    }
    $('pwEvac').classList.toggle('on', S.mode === 'evac');
    $('pwZen').classList.toggle('on', S.mode === 'zen');
    $('pwZen').classList.toggle('off', S.zenCD > 0);
    $('pwZen').style.setProperty('--cd', S.zenCD > 0 ? (S.zenCD / S.zenMax) : 0);
  }
  function banner(t, ms = 2600) { S.bannerText = t; S.bannerT = ms / 1000; }
  function floatText(x, y, t, color = '#fff', size = 16, life = 1.1) { S.texts.push({ x, y, t, color, size, life, max: life }); }
  function burst(x, y, e, n = 1) {
    if (!settings.effects && n > 1) n = 1;
    for (let i = 0; i < n; i++) S.fx.push({ x: x + (Math.random() - .5) * 18, y: y + (Math.random() - .5) * 18, vx: (Math.random() - .5) * 70, vy: -30 - Math.random() * 40, e, life: .9, max: .9, s: 22 + Math.random() * 10 });
  }

  /* ---------- машины ---------- */
  function mk(type, li, t) {
    const T = TYPES[type];
    const c = {
      id: ++S.uid, type, lane: li, t, v: T.vmax * .8, len: T.len, wid: T.wid,
      vmax: T.vmax * (.92 + Math.random() * .16), anger: 0, rate: T.rate * S.patience,
      color: T.color || (T.colors ? pick(T.colors) : '#FFFFFF'), icon: T.icon || '', state: 'normal', committed: false, cleared: false,
      stall: 0, stallDone: false, ambWait: 0, group: null, said60: false, said85: false, x: 0, y: 0, ang: LANES[li].ang, dead: false
    };
    place(c); S.cars.push(c); return c;
  }
  function place(c) { if (c.state === 'ram') return; const L = LANES[c.lane]; c.x = L.x + L.dx * c.t; c.y = L.y + L.dy * c.t; }
  function laneClear(li, minT) { return !S.cars.some(c => c.lane === li && c.state !== 'ram' && !c.dead && (c.t - c.len / 2) < minT); }
  function spawnOne() {
    const type = pickW(weights), li = rnd(4);
    if (type === 'cortege') {
      if (!laneClear(li, 400)) return false;
      const g = { left: 5, failed: false };
      for (let i = 0; i < 5; i++) { const c = mk(i === 0 ? 'limo' : 'wcar', li, -i * 72); c.group = g; if (i === 2) c.icon = '🎀'; if (i === 4) c.icon = '🥂'; }
      banner('💒 СВАДЬБА!\nНе разрывай кортеж', 1800); sfx.honk(); return true;
    }
    if (type === 'goose') {
      if (!laneClear(li, 150)) return false;
      for (let i = 0; i < 3; i++) mk('goose', li, -i * 32);
      return true;
    }
    if (!laneClear(li, 80)) return false;
    mk(type, li, 0);
    if (type === 'amb') { banner('🚑 СКОРАЯ!\nПропусти быстро', 1600); sfx.siren(); }
    return true;
  }
  function removeCar(c) { c.dead = true; if (c.group) c.group.failed = true; }
  function rage(c) {
    c.state = 'run';
    if (c.group) c.group.failed = true;
    if (!c.group && Math.random() < .45) {
      c.state = 'ram'; c.v = 0; c.ang = Math.atan2(C.y - c.y, C.x - c.x);
      floatText(c.x, c.y - 34, 'ТЕБЕ КОНЕЦ!', '#FF3B30', 17, 1.4);
    } else {
      c.committed = true;
      floatText(c.x, c.y - 34, 'ПРОРЫВАЮСЬ!', '#FF3B30', 17, 1.4);
    }
    sfx.honk(); burst(c.x, c.y, '💢', 1);
  }
  function crash(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    removeCar(a); removeCar(b);
    burst(mx, my, '💥', 3); burst(mx, my, '🔥', 2);
    floatText(mx, my - 20, 'ДТП!', '#FF3B30', 28, 1.6);
    if (settings.effects) S.shake = .45;
    sfx.crash(); buzz(120);
    S.stats.crashes++;
    if (o.goal && o.goal.noCrash) { S.lives = 0; updateHud(); finish(false, 'Начальник видел ДТП. Чистой смены не вышло'); return; }
    loseLife('Два водителя нашли друг друга на перекрёстке');
  }
  function loseLife(reason) { S.lives--; updateHud(); if (S.lives <= 0) finish(false, reason); }

  /* ---------- силы ---------- */
  function setMode(m) {
    if (!isRunning()) return; sfx.tap();
    S.mode = (S.mode === m) ? null : m;
    if (S.mode === 'evac' && S.powers.evac <= 0) S.mode = null;
    if (S.mode === 'zen' && S.zenCD > 0) S.mode = null;
    updateHud();
  }
  function useSiren() {
    if (!isRunning() || S.powers.siren <= 0 || S.frozen > 0) return;
    S.powers.siren--; S.used.siren++; S.frozen = 4; S.mode = null; sfx.siren();
    banner('🚨 СИРЕНА!\nВсе замерли', 1800); updateHud();
  }
  function useDonut() {
    if (!isRunning() || S.powers.donut <= 0) return;
    S.powers.donut--; S.used.donut++; S.mode = null; sfx.ding();
    for (const c of S.cars) if (c.state === 'normal' && c.anger > 0) { c.anger = 0; c.said60 = c.said85 = false; floatText(c.x, c.y - 30, '🍩', '#fff', 20); }
    banner('🍩 Пончик мира!\nВсе добрые', 1600); updateHud();
  }
  function awardBonus() {
    const k = pick(['evac', 'siren', 'donut', 'donut', 'life']);
    if (k === 'life' && S.lives < S.maxLives) { S.lives++; banner('🎁 ПРЕМИЯ! +❤️', 1800); }
    else { const kk = k === 'life' ? 'donut' : k; S.powers[kk]++; banner('🎁 ПРЕМИЯ! +' + ({ evac: '🏗️', siren: '🚨', donut: '🍩' })[kk], 1800); }
    sfx.ding(); updateHud();
  }
  function setAxis(ax) { if (ax !== S.green) { S.green = ax; sfx.whistle(); S.ringPulse = 1; S.tutorial = 0; } }
  function tap(x, y) {
    if (S.over) return;
    if (S.mode === 'evac') {
      let bc = null, bd = 44;
      for (const c of S.cars) { if (c.dead) continue; const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; bc = c; } }
      if (bc) {
        S.powers.evac--; S.used.evac++; S.mode = null; removeCar(bc);
        burst(bc.x, bc.y, '🏗️', 1); burst(bc.x, bc.y, '💨', 2);
        floatText(bc.x, bc.y - 20, 'ЭВАКУИРОВАН!', '#2D7DFF', 16, 1.3); sfx.pop(); updateHud();
      }
      return;
    }
    const dx = x - C.x, dy = y - C.y;
    if (S.mode === 'zen') {
      const li = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 0 : 1) : (dx < 0 ? 2 : 3);
      for (const c of S.cars) if (c.lane === li && c.state === 'normal') { c.anger = 0; c.said60 = c.said85 = false; burst(c.x, c.y, '✨', 1); }
      S.zenCD = S.zenMax; S.mode = null; sfx.ding();
      floatText(x, y, 'ДЗЕН…', '#A259FF', 22, 1.2); updateHud();
      return;
    }
    const inV = Math.abs(dx) < R, inH = Math.abs(dy) < R;
    let ax;
    if (inV && !inH) ax = 0; else if (inH && !inV) ax = 1; else ax = 1 - S.green;
    setAxis(ax);
  }

  /* ---------- обновление ---------- */
  function update(dt) {
    S.time += dt;
    const d = Math.min(1, S.time / 140), mult = 1 + d * .6;
    S.shake = Math.max(0, S.shake - dt); S.copHurt = Math.max(0, S.copHurt - dt); S.ringPulse = Math.max(0, S.ringPulse - dt * 2.5);
    if (S.zenCD > 0) S.zenCD = Math.max(0, S.zenCD - dt);
    if (S.bannerT > 0) S.bannerT -= dt;
    if (S.tutorial > 0 && S.time > 10) S.tutorial = 0;
    const stopped = S.frozen > 0;
    if (stopped) S.frozen -= dt;
    else if (!S.over) {
      S.score += dt;
      S.spawnT -= dt;
      if (S.spawnT <= 0) { const ok = spawnOne(); const iv = (1.9 - 1.15 * d) * S.spawnMul; S.spawnT = ok ? iv * (.6 + Math.random() * .8) : .3; }
      moveCars(dt, mult);
    }
    for (const c of S.cars) {
      if (c.dead || c.state !== 'ram' || stopped || S.over) continue;
      const dx = C.x - c.x, dy = C.y - c.y, dist = Math.hypot(dx, dy);
      c.ang = Math.atan2(dy, dx); c.v = Math.min(270, c.v + 420 * dt);
      c.x += dx / dist * c.v * dt; c.y += dy / dist * c.v * dt;
      if (dist < 22) {
        c.dead = true; S.copHurt = 1; if (settings.effects) S.shake = .4;
        burst(C.x, C.y, '💫', 3); floatText(C.x, C.y - 40, 'ТЕБЯ СБИЛИ!', '#FF3B30', 22, 1.6);
        sfx.hurt(); buzz(200); loseLife('Тебя сбил разъярённый водитель');
      }
    }
    if (!stopped && !S.over) for (let i = 0; i < S.cars.length; i++) {
      const a = S.cars[i]; if (a.dead || a.state === 'ram') continue;
      for (let j = i + 1; j < S.cars.length; j++) {
        const b = S.cars[j]; if (b.dead || b.state === 'ram') continue;
        if (LANES[a.lane].axis === LANES[b.lane].axis) continue;
        if (overlap(a, b)) { crash(a, b); break; }
      }
    }
    stepFx(dt);
    S.cars = S.cars.filter(c => !c.dead);
    if (!S.over && S.score >= S.nextBonus) { S.nextBonus += S.bonusEvery; awardBonus(); }
    const p = progress();
    if (p && p.done && !S.over) finish(true, '');
    updateHud();
  }
  function stepFx(dt) {
    for (const p of S.fx) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    S.fx = S.fx.filter(p => p.life > 0);
    for (const t of S.texts) { t.life -= dt; t.y -= 22 * dt; }
    S.texts = S.texts.filter(t => t.life > 0);
  }
  function box(c) {
    const horiz = LANES[c.lane].dx !== 0;
    const hw = (horiz ? c.len : c.wid) / 2 - 3, hh = (horiz ? c.wid : c.len) / 2 - 3;
    return [c.x - hw, c.y - hh, c.x + hw, c.y + hh];
  }
  function overlap(a, b) { const p = box(a), q = box(b); return p[0] < q[2] && p[2] > q[0] && p[1] < q[3] && p[3] > q[1]; }
  function moveCars(dt, mult) {
    for (let li = 0; li < 4; li++) {
      const L = LANES[li];
      const list = S.cars.filter(c => c.lane === li && c.state !== 'ram' && !c.dead).sort((a, b) => b.t - a.t);
      const red = L.axis !== S.green;
      for (let i = 0; i < list.length; i++) {
        const c = list[i], leader = list[i - 1], T = TYPES[c.type];
        const front = c.t + c.len / 2;
        let dist = Infinity;
        if (leader) dist = (leader.t - leader.len / 2) - front - 10;
        const dLine = L.stopT - front;
        if (red && c.state !== 'run' && !c.committed && dLine > -1) {
          if (dLine < c.v * c.v / (2 * BR * 1.5) && c.v > 20) c.committed = true;
          else dist = Math.min(dist, dLine);
        }
        const queued = front < L.stopT + 4;
        if (T.stalls && !c.stallDone && Math.abs(c.t - L.centerT) < 10) {
          c.stallDone = true; c.stall = 2.8; floatText(c.x, c.y - 30, 'ЗАГЛОХ!', '#FF5FAE', 16, 1.4); burst(c.x, c.y, '💨', 2);
        }
        let vd;
        if (c.stall > 0) { c.stall -= dt; vd = 0; }
        else vd = Math.min(c.vmax * (c.state === 'run' ? 1.45 : 1), Math.sqrt(2 * BR * Math.max(dist, 0)) * .85);
        if (vd > c.v) c.v = Math.min(vd, c.v + AC * dt); else c.v = Math.max(vd, c.v - BR * 1.5 * dt);
        c.t += c.v * dt; place(c);

        if (c.rate > 0 && c.state === 'normal') {
          if (queued && c.v < 8) c.anger += c.rate * mult * dt;
          else if (queued && c.v < c.vmax * .6) c.anger += c.rate * mult * .35 * dt;
          else c.anger = Math.max(0, c.anger - 4 * dt);
          if (!c.said60 && c.anger >= 60) { c.said60 = true; floatText(c.x, c.y - 40, 'БИИИП!', '#FFD60A', 15); sfx.honk(); }
          if (!c.said85 && c.anger >= 85) { c.said85 = true; floatText(c.x, c.y - 40, pick(INSULTS), '#FF3B30', 15, 1.3); }
          if (c.anger >= 100) rage(c);
        }
        if (c.type === 'amb') {
          if (queued && c.v < 8) c.ambWait += dt; else c.ambWait = Math.max(0, c.ambWait - dt * .5);
          if (c.ambWait > 4.2) {
            c.dead = true; burst(c.x, c.y, '💀', 1);
            floatText(c.x, c.y - 20, 'СКОРАЯ ОПОЗДАЛА!', '#FF3B30', 16, 1.6); sfx.hurt(); if (settings.effects) S.shake = .3; buzz(120);
            loseLife('Скорая опоздала из-за тебя');
          }
        }
        if (!c.cleared && c.t - c.len / 2 > L.boxEndT) {
          c.cleared = true;
          if (c.state === 'normal') {
            S.score += T.pts; S.stats.cars++;
            if (c.type === 'amb') S.stats.amb++;
            if (c.type === 'cow') S.stats.cow++;
            if (c.type === 'taxi') S.stats.taxi++;
            floatText(c.x, c.y - 16, '+' + T.pts, c.type === 'amb' ? '#3DDC5C' : '#FFFFFF', c.type === 'amb' ? 20 : 15);
            if (c.group) {
              c.group.left--;
              if (c.group.left === 0 && !c.group.failed) { S.score += 150; S.stats.cortege++; floatText(C.x, C.y - 80, 'КОРТЕЖ ЦЕЛ! +150', '#FF5FAE', 20, 2); burst(C.x, C.y, '🎉', 3); sfx.ding(); }
            }
          }
        }
        if (c.t - c.len / 2 > L.total) c.dead = true;
      }
    }
  }

  /* ---------- рисование ---------- */
  function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
  function emoji(e, x, y, s) { ctx.fillStyle = '#000'; ctx.font = s + 'px ' + EMOJI; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }
  function outText(t, x, y, size, color, maxW) {
    ctx.font = '900 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    if (maxW) { ctx.strokeText(t, x, y + 2, maxW); ctx.strokeText(t, x, y, maxW); ctx.fillStyle = color; ctx.fillText(t, x, y, maxW); }
    else { ctx.strokeText(t, x, y + 2); ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); }
  }
  function shade(hex, p) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    if (p < 0) { r *= 1 + p; g *= 1 + p; b *= 1 + p; } else { r += (255 - r) * p; g += (255 - g) * p; b += (255 - b) * p; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function ink(w) { ctx.lineWidth = w || 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }

  function drawWorld() {
    const t = theme;
    ctx.fillStyle = t.road; ctx.fillRect(0, 0, W, H);
    const blocks = [[-40, -40, C.x - R + 40, C.y - R + 40], [C.x + R, -40, W - C.x - R + 40, C.y - R + 40], [-40, C.y + R, C.x - R + 40, H - C.y - R + 40], [C.x + R, C.y + R, W - C.x - R + 40, H - C.y - R + 40]];
    for (const [x, y, w, h] of blocks) {
      ctx.fillStyle = t.walk; rr(x, y, w, h, 28); ctx.fill(); ink(3);
      ctx.fillStyle = t.ground; rr(x + 14, y + 14, w - 28, h - 28, 16); ctx.fill();
    }
    // разметка
    ctx.fillStyle = t.line;
    for (let y = -10; y < H; y += 34) if (y + 18 < C.y - R - 30 || y > C.y + R + 30) { rr(C.x - 2.5, y, 5, 18, 2); ctx.fill(); }
    for (let x = -10; x < W; x += 34) if (x + 18 < C.x - R - 30 || x > C.x + R + 30) { rr(x, C.y - 2.5, 18, 5, 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 6; i < R * 2 - 4; i += 14) {
      rr(C.x - R + i, C.y - R - 22, 8, 16, 2); ctx.fill(); rr(C.x - R + i, C.y + R + 6, 8, 16, 2); ctx.fill();
      rr(C.x - R - 22, C.y - R + i, 16, 8, 2); ctx.fill(); rr(C.x + R + 6, C.y - R + i, 16, 8, 2); ctx.fill();
    }
    // крыши / деревья
    for (const d of S.deco) drawDeco(d);
    // стоп-линии
    for (let li = 0; li < 4; li++) {
      const L = LANES[li], g = L.axis === S.green, col = g ? '#3DDC5C' : '#FF3B30';
      ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = col; ctx.fillStyle = col;
      const of = R + 26;
      if (li === 0) rr(C.x - R + 4, C.y - of, R - 8, 7, 3);
      if (li === 1) rr(C.x + 4, C.y + of - 7, R - 8, 7, 3);
      if (li === 2) rr(C.x - of, C.y + 4, 7, R - 8, 3);
      if (li === 3) rr(C.x + of - 7, C.y - R + 4, 7, R - 8, 3);
      ctx.fill(); ctx.restore(); ink(2);
    }
    // шевроны на зелёной оси
    ctx.save(); ctx.globalAlpha = .55 + .35 * Math.sin(S.time * 7);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const L of LANES) {
      if (L.axis !== S.green) continue; const tt = L.stopT - 34;
      ctx.save(); ctx.translate(L.x + L.dx * tt, L.y + L.dy * tt); ctx.rotate(L.ang);
      for (const k of [-8, 6]) { ctx.beginPath(); ctx.moveTo(k - 6, -9); ctx.lineTo(k + 3, 0); ctx.lineTo(k - 6, 9); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawDeco(d) {
    if (d.k === 'roof') {
      ctx.fillStyle = SHADOW; rr(d.x + 5, d.y + 9, d.w, d.h, 6); ctx.fill();
      ctx.fillStyle = shade(d.c, -.3); rr(d.x, d.y + 6, d.w, d.h, 6); ctx.fill(); ink(2.5);
      ctx.fillStyle = d.c; rr(d.x, d.y, d.w, d.h, 6); ctx.fill(); ink(2.5);
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; rr(d.x + 5, d.y + 5, d.w - 10, d.h - 10, 4); ctx.stroke();
      if (d.ac) { ctx.fillStyle = '#E6EAF2'; rr(d.x + d.w - 22, d.y + 9, 13, 11, 2); ctx.fill(); ink(2); }
      if (d.tank) { ctx.fillStyle = '#B8C2D6'; circle(d.x + 16, d.y + d.h - 16, 7); ctx.fill(); ink(2); }
    } else if (d.k === 'tree') {
      ctx.fillStyle = SHADOW; circle(d.x + 4, d.y + 6, d.s); ctx.fill();
      ctx.fillStyle = '#2FBF4A'; circle(d.x, d.y, d.s); ctx.fill(); ink(2.5);
      ctx.fillStyle = '#5CE06F'; circle(d.x - d.s * .3, d.y - d.s * .3, d.s * .45); ctx.fill();
    } else if (d.k === 'emoji') emoji(d.e, d.x, d.y, 24);
  }
  function drawCar(c) {
    const T = TYPES[c.type], L = c.len, Wd = c.wid;
    if (T.animal) {
      ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(c.x + 3, c.y + 8, T.animal * .45, T.animal * .25, 0, 0, Math.PI * 2); ctx.fill();
      emoji(c.icon, c.x, c.y - Math.abs(Math.sin(S.time * 8 + c.id)) * 3, T.animal); return;
    }
    ctx.save(); ctx.translate(c.x + 5, c.y + 7); ctx.rotate(c.ang); ctx.fillStyle = SHADOW; rr(-L / 2, -Wd / 2, L, Wd, 10); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(c.x, c.y + 4); ctx.rotate(c.ang);
    ctx.fillStyle = INK;
    const wx = c.type === 'tractor' ? [-L * .28, L * .3] : [-L * .3, L * .3];
    for (const x of wx) for (const s of [-1, 1]) { const big = c.type === 'tractor' && x < 0; const ww = big ? 16 : 11, wh = big ? 7 : 5; rr(x - ww / 2, s > 0 ? Wd / 2 - wh + 3 : -Wd / 2 - 3, ww, wh, 2); ctx.fill(); }
    ctx.fillStyle = shade(c.color, -.35); rr(-L / 2, -Wd / 2, L, Wd, 10); ctx.fill(); ink(2.5);
    ctx.restore();
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang);
    ctx.fillStyle = c.color; rr(-L / 2, -Wd / 2, L, Wd, 10); ctx.fill(); ink(2.5);
    const glass = '#26305A';
    if (c.type === 'bus') {
      ctx.fillStyle = glass; rr(-L / 2 + 8, -Wd / 2 + 3, L - 20, 5, 2); ctx.fill(); rr(-L / 2 + 8, Wd / 2 - 8, L - 20, 5, 2); ctx.fill();
      rr(L / 2 - 8, -Wd / 2 + 4, 5, Wd - 8, 2); ctx.fill();
      ctx.fillStyle = INK; for (let x = -L / 2 + 14; x < L / 2 - 14; x += 14) ctx.fillRect(x, -Wd / 2 + 10, 2, Wd - 20);
    } else if (c.type === 'tractor') {
      ctx.fillStyle = shade(c.color, .25); rr(4, -Wd / 2 + 6, L / 2 - 6, Wd - 12, 4); ctx.fill(); ink(2);
      ctx.fillStyle = glass; rr(-L / 2 + 4, -Wd / 2 + 4, L * .42, Wd - 8, 4); ctx.fill(); ink(2);
    } else {
      const cl = c.type === 'limo' ? L * .62 : L * .48, cx0 = -L * .26;
      ctx.fillStyle = glass; rr(cx0, -Wd / 2 + 3, cl, Wd - 6, 6); ctx.fill(); ink(2);
      ctx.fillStyle = shade(c.color, .15); rr(cx0 + 6, -Wd / 2 + 5, cl - 14, Wd - 10, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(cx0 + 8, -Wd / 2 + 6, cl - 18, 3, 2); ctx.fill();
      ctx.fillStyle = '#FFF3B0'; circle(L / 2 - 4, -Wd / 2 + 6, 2.6); ctx.fill(); circle(L / 2 - 4, Wd / 2 - 6, 2.6); ctx.fill();
      ctx.fillStyle = '#FF3B30'; ctx.fillRect(-L / 2 + 1, -Wd / 2 + 4, 2.5, 5); ctx.fillRect(-L / 2 + 1, Wd / 2 - 9, 2.5, 5);
      if (c.type === 'taxi') {
        ctx.fillStyle = INK; rr(-5, -7, 10, 14, 2); ctx.fill();
        ctx.fillStyle = '#FFD60A'; ctx.fillRect(-5, -7, 5, 4.6); ctx.fillRect(0, -2.4, 5, 4.6); ctx.fillRect(-5, 2.3, 5, 4.6);
      }
      if (c.type === 'amb') {
        ctx.fillStyle = '#FF3B30'; ctx.fillRect(-11, -2.5, 14, 5); ctx.fillRect(-6.5, -7, 5, 14);
        const f = Math.floor(S.time * 8) % 2;
        ctx.fillStyle = f ? '#FF2B2B' : '#2B6BFF'; rr(cx0 + cl - 8, -Wd / 2 + 3, 5, Wd / 2 - 3, 2); ctx.fill();
        ctx.fillStyle = f ? '#2B6BFF' : '#FF2B2B'; rr(cx0 + cl - 8, 0, 5, Wd / 2 - 3, 2); ctx.fill();
      }
      if (c.type === 'limo') { ctx.fillStyle = '#FF5FAE'; ctx.fillRect(-3, -Wd / 2, 6, Wd); }
      if (c.type === 'clown') { ctx.fillStyle = '#FFE14D'; for (const [x, y] of [[-L / 2 + 6, -8], [L / 2 - 10, 7], [-L / 2 + 8, 8], [L / 2 - 9, -7]]) { circle(x, y, 3); ctx.fill(); } }
    }
    if (c.state === 'run' || c.state === 'ram') { ctx.strokeStyle = '#FF3B30'; ctx.lineWidth = 3; rr(-L / 2 - 4, -Wd / 2 - 4, L + 8, Wd + 8, 12); ctx.stroke(); }
    ctx.restore();
    if (c.icon) emoji(c.icon, c.x, c.y, 17);
    if (c.stall > 0) emoji('💨', c.x + (Math.random() - .5) * 5, c.y - 20, 18);
  }
  const FACES = ['😄', '🙂', '😐', '😠', '🤬'];
  const moodColor = a => a < .35 ? '#3DDC5C' : a < .6 ? '#FFD60A' : a < .85 ? '#FF9F1C' : '#FF3B30';
  function drawMood(c) {
    const horiz = LANES[c.lane].dx !== 0;
    const bx = c.x, by = c.y - (horiz ? c.wid / 2 + 12 : c.len / 2 + 4);
    if (c.type === 'amb') {
      if (c.ambWait <= .1 || c.state !== 'normal') return;
      const left = Math.max(0, 4.2 - c.ambWait), p = left / 4.2;
      ctx.fillStyle = '#FFFFFF'; circle(bx, by, 15); ctx.fill(); ink(2.5);
      ctx.strokeStyle = p < .35 ? '#FF3B30' : '#FF9F1C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, 11, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      outText(left.toFixed(1), bx, by + 1, 11, '#fff');
      return;
    }
    if (c.rate <= 0 || c.cleared) return;
    if (c.state !== 'normal') {
      const s = 1 + .15 * Math.sin(S.time * 20);
      ctx.fillStyle = '#FF3B30'; circle(bx, by, 14 * s); ctx.fill(); ink(2.5);
      emoji('🤬', bx, by, 20); return;
    }
    const a = Math.min(1, c.anger / 100), col = moodColor(a);
    if (a < .05 && !settings.effects) return;
    const j = a > .85 ? (Math.random() - .5) * 2.5 : 0;
    ctx.fillStyle = '#FFFFFF'; circle(bx + j, by, 14); ctx.fill(); ink(2.5);
    if (a > .02) { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(bx + j, by, 14, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2); ctx.stroke(); }
    emoji(FACES[Math.min(4, Math.floor(a * 5))], bx + j, by + 1, 19);
  }
  function drawHat(hat) {
    // голова смотрит «вверх» (−y)
    if (hat === 'ushanka') {
      ctx.fillStyle = '#8D5A3B'; ctx.beginPath(); ctx.ellipse(-8, 0, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ink(2);
      ctx.beginPath(); ctx.ellipse(8, 0, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); ink(2);
      ctx.fillStyle = '#A9744F'; circle(0, -1, 8.5); ctx.fill(); ink(2);
      ctx.fillStyle = '#C9C9C9'; rr(-6, -9, 12, 4, 2); ctx.fill();
    } else if (hat === 'cowboy') {
      ctx.fillStyle = '#B9733A'; ctx.beginPath(); ctx.ellipse(0, -1, 14, 11, 0, 0, Math.PI * 2); ctx.fill(); ink(2);
      ctx.fillStyle = '#8A5226'; circle(0, -1, 7); ctx.fill(); ink(2);
    } else if (hat === 'hardhat') {
      ctx.fillStyle = '#FFD60A'; circle(0, -1, 9); ctx.fill(); ink(2);
      ctx.fillStyle = '#E0B000'; rr(-1.5, -10, 3, 18, 1.5); ctx.fill();
    } else if (hat === 'crown') {
      ctx.fillStyle = '#FFC400'; circle(0, -1, 8.5); ctx.fill(); ink(2);
      ctx.fillStyle = '#FF3B30'; circle(0, -1, 2.5); ctx.fill();
      ctx.fillStyle = '#FFF3B0'; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; circle(Math.cos(a) * 6.5, -1 + Math.sin(a) * 6.5, 1.8); ctx.fill(); }
    } else if (hat === 'cone') {
      ctx.fillStyle = '#FF7A1A'; circle(0, -1, 9.5); ctx.fill(); ink(2);
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5; circle(0, -1, 5.5); ctx.stroke();
      ctx.fillStyle = '#FF7A1A'; circle(0, -1, 3); ctx.fill(); ink(1.5);
    } else {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, -6, 6.5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#23409E'; circle(0, -1, 8); ctx.fill(); ink(2);
      ctx.fillStyle = '#3D63D4'; circle(-1.5, -2.5, 4); ctx.fill();
      ctx.fillStyle = '#FFD60A'; circle(0, -6.5, 1.8); ctx.fill();
    }
  }
  function drawCop() {
    const x = C.x, y = C.y, cos = o.cosmetics || {};
    const uni = (WARDROBE.uniform.find(u => u.id === cos.uniform) || WARDROBE.uniform[0]).color;
    const bat = WARDROBE.baton.find(b => b.id === cos.baton) || WARDROBE.baton[0];
    const pr = 19 + S.ringPulse * 8 + Math.sin(S.time * 4) * 1.2;
    ctx.fillStyle = 'rgba(61,220,92,.3)'; circle(x, y + 3, pr + 5); ctx.fill();
    ctx.strokeStyle = '#3DDC5C'; ctx.lineWidth = 5; circle(x, y + 3, pr); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; circle(x, y + 3, pr + 3); ctx.stroke();
    const target = S.green === 0 ? -Math.PI / 2 : Math.PI;
    let diff = target - S.copAng; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    S.copAng += diff * .18;
    ctx.save(); ctx.translate(x, y);
    if (S.copHurt > 0) ctx.rotate(S.time * 25 * S.copHurt);
    ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.ellipse(5, 7, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(S.copAng + Math.PI / 2);
    // жезл
    const wave = Math.sin(S.time * 9) * .5;
    ctx.save(); ctx.translate(11, -2); ctx.rotate(-Math.PI / 2 + wave);
    ctx.lineCap = 'round';
    if (bat.glow) { ctx.shadowBlur = 12; ctx.shadowColor = bat.glow; }
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(25, 0); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = bat.main; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(25, 0); ctx.stroke();
    ctx.strokeStyle = bat.stripe; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(15, 0); ctx.moveTo(19, 0); ctx.lineTo(22, 0); ctx.stroke();
    if (bat.tip) { ctx.save(); ctx.translate(27, 0); ctx.rotate(Math.PI / 2); emoji(bat.tip, 0, 0, 16); ctx.restore(); }
    ctx.restore();
    ctx.fillStyle = shade(uni, -.25); ctx.beginPath(); ctx.ellipse(0, 2, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); ink(2.5);
    ctx.fillStyle = uni; ctx.beginPath(); ctx.ellipse(0, 1, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD60A'; circle(-6, 0, 1.8); ctx.fill();
    ctx.fillStyle = '#F2C49B'; circle(11, -3, 3.4); ctx.fill(); ink(1.5); circle(-11, 1, 3.2); ctx.fill(); ink(1.5);
    drawHat(cos.hat);
    ctx.restore();
  }
  function drawEdgeQueues() {
    for (let li = 0; li < 4; li++) {
      const L = LANES[li];
      let n = 0, mx = 0;
      for (const c of S.cars) { if (c.lane !== li || c.state === 'ram' || c.dead) continue; if (c.t + c.len / 2 < OFF + 6) { n++; mx = Math.max(mx, c.anger); } }
      if (!n) continue;
      let x, y;
      if (li === 0) { x = L.x; y = 120; } else if (li === 1) { x = L.x; y = H - 24; } else if (li === 2) { x = 30; y = L.y; } else { x = W - 30; y = L.y; }
      ctx.fillStyle = '#FFFFFF'; rr(x - 27, y - 13, 54, 26, 13); ctx.fill(); ink(2.5);
      ctx.strokeStyle = moodColor(mx / 100); ctx.lineWidth = 3; rr(x - 23, y - 9, 46, 18, 9); ctx.stroke();
      emoji(FACES[Math.min(4, Math.floor(mx / 20))], x - 11, y + 1, 14);
      ctx.fillStyle = INK; ctx.font = '900 13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+' + n, x + 11, y + 1);
    }
  }
  function render() {
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - .5) * 12 * S.shake, (Math.random() - .5) * 12 * S.shake);
    drawWorld();
    for (const c of S.cars) if (c.state !== 'ram') drawCar(c);
    drawCop();
    for (const c of S.cars) if (c.state === 'ram') drawCar(c);
    if (o.night) {
      const g = ctx.createRadialGradient(C.x, C.y, 60, C.x, C.y, Math.max(W, H) * .6);
      g.addColorStop(0, 'rgba(8,10,35,0)'); g.addColorStop(.45, 'rgba(8,10,35,.55)'); g.addColorStop(1, 'rgba(8,10,35,.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const c of S.cars) if (!c.dead && !TYPES[c.type].animal) { ctx.fillStyle = 'rgba(255,240,160,.85)'; circle(c.x + Math.cos(c.ang) * c.len / 2, c.y + Math.sin(c.ang) * c.len / 2, 3.5); ctx.fill(); }
    }
    for (const c of S.cars) drawMood(c);
    for (const p of S.fx) { ctx.globalAlpha = Math.max(0, p.life / p.max); emoji(p.e, p.x, p.y, p.s); }
    ctx.globalAlpha = 1;
    for (const t of S.texts) { ctx.globalAlpha = Math.min(1, t.life / (t.max * .5)); outText(t.t, t.x, t.y, t.size, t.color); }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawEdgeQueues();
    if (S.tutorial > 0) {
      const L = LANES[S.green === 0 ? 2 : 3];
      const hx = S.green === 0 ? C.x - R - 70 : C.x + R + 70, hy = L.y + (S.green === 0 ? 36 : -36) + Math.sin(S.time * 6) * 6;
      outText('ТАПНИ СЮДА', hx, hy - 36, 15, '#FFD60A');
      emoji('👆', hx, hy, 34);
    }
    if (S.frozen > 0) {
      ctx.fillStyle = Math.floor(S.time * 8) % 2 ? 'rgba(255,60,60,.14)' : 'rgba(60,110,255,.14)'; ctx.fillRect(0, 0, W, H);
      outText('🚨 СТОЯТЬ! ' + S.frozen.toFixed(1), W / 2, C.y + R + 70, 22, '#fff');
    }
    if (S.mode) outText(S.mode === 'evac' ? 'ТАПНИ МАШИНУ — УБРАТЬ' : 'ТАПНИ НАПРАВЛЕНИЕ — УСПОКОИТЬ', W / 2, H - 56, 16, '#FFD60A');
    if (S.bannerT > 0) {
      const lines = S.bannerText.split('\n'), a = Math.min(1, S.bannerT * 3), h = lines.length * 24 + 18, y0 = Math.round(H * .2);
      ctx.globalAlpha = a;
      ctx.fillStyle = INK; rr(34, y0 + 6, W - 68, h, 16); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; rr(34, y0, W - 68, h, 16); ctx.fill(); ink(3);
      lines.forEach((l, i) => {
        if (i === 0) outText(l, W / 2, y0 + 9 + 12, 20, '#FF3B30', W - 90);
        else { ctx.fillStyle = INK; ctx.font = '700 14px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, W / 2, y0 + 9 + 12 + i * 24, W - 90); }
      });
      ctx.globalAlpha = 1;
    }
  }
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (running && !paused) update(dt);
    if (running) render();
    if (running) raf = requestAnimationFrame(loop);
  }
  return { init, start, pause, resume, quit, isRunning, sfx, audio, settings, fit: () => running && fit() };
})();
