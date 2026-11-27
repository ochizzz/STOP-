/* ============ СТОП! — правила симуляции перекрёстка ============
   Чистая логика: без DOM, канваса и звука. Всё, что должно «прозвучать» или
   «показаться», уходит наружу событиями через on(). Шаг времени задаёт вызывающий. */
import { THEMES, TYPES, DISTRICT_W, NAME, RAM_REASON, RAM_TYPES, INSULTS } from '../config/data.js';
import { createRng } from './rng.js';

export const W = 490, R = 66, LANE = 33, OFF = 90;
export const STEP = 1 / 60;                 // фиксированный шаг симуляции
export const FUME = 1.4;                    // сколько водитель «кипит» перед яростью
const BR = 320, AC = 190, AMBER_MIN = .45, AMBER_MAX = 3.5, AMB_LIMIT = 4.2;

export function computeGeometry(H) {
  const C = { x: W / 2, y: Math.round(H / 2) + 14 };
  const LANES = [
    { axis: 0, dx: 0, dy: 1, x: C.x - LANE, y: -OFF },
    { axis: 0, dx: 0, dy: -1, x: C.x + LANE, y: H + OFF },
    { axis: 1, dx: 1, dy: 0, x: -OFF, y: C.y + LANE },
    { axis: 1, dx: -1, dy: 0, x: W + OFF, y: C.y - LANE },
  ];
  for (const L of LANES) {
    L.ang = Math.atan2(L.dy, L.dx);
    L.centerT = (C.x - L.x) * L.dx + (C.y - L.y) * L.dy;
    L.stopT = L.centerT - R - 24;
    L.boxStartT = L.centerT - R;
    L.boxEndT = L.centerT + R;
    L.total = (L.dx ? W : H) + OFF * 2;
  }
  return { C, LANES };
}

/**
 * @param {object} o опции смены: theme, w, goal, spawnMul, lives, powers, zenCD, patience, bonusEvery, seed, H
 */
export function createSim(o) {
  const H = o.H || 820;
  const { C, LANES } = computeGeometry(H);
  const rng = createRng(o.seed ?? 1);
  const weights = Object.assign({}, DISTRICT_W[o.theme] || DISTRICT_W.wedding, o.w || {});
  for (const k in weights) if (!weights[k]) delete weights[k];
  const listeners = [];
  const emit = (type, data) => { for (const f of listeners) f(type, data); };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const S = {
    cars: [], uid: 0, time: 0, score: 0,
    lives: o.lives || 3, maxLives: o.lives || 3,
    green: 0, prev: 0, pending: -1, amber: 0,
    spawnT: .6, frozen: 0, zenCD: 0, zenMax: o.zenCD || 14,
    powers: Object.assign({ evac: 0, siren: 0, donut: 0 }, o.powers), used: { evac: 0, siren: 0, donut: 0 },
    bonusEvery: o.bonusEvery || 400, nextBonus: o.bonusEvery || 400,
    patience: o.patience || 1, spawnMul: o.spawnMul || 1, phase: 'calm', forceType: null, chorusT: 0,
    over: false, win: false, reason: '',
    stats: { cars: 0, amb: 0, cortege: 0, cow: 0, taxi: 0, crashes: 0 },
  };

  /* ---------- цели ---------- */
  function progress() {
    const g = o.goal; if (!g) return null;
    const st = S.stats;
    const cur = { survive: S.time, score: S.score, cars: st.cars, amb: st.amb, cortege: st.cortege, cow: st.cow }[g.type];
    const need = g.type === 'survive' ? g.t : g.n;
    return { cur: Math.min(cur, need), need, done: cur >= need };
  }
  function finish(win, reason) {
    if (S.over) return;
    S.over = true; S.win = win; if (reason) S.reason = reason;
    emit('finish', { win, reason: S.reason });
  }

  /* ---------- машины ---------- */
  const inLane = c => c.state !== 'ram' && c.state !== 'escape' && !c.dead;
  function mk(type, li, t) {
    const T = TYPES[type];
    const c = {
      id: ++S.uid, type, lane: li, t, v: T.vmax * .8, len: T.len, wid: T.wid,
      vmax: T.vmax * (.92 + rng.next() * .16), anger: 0, rate: T.rate * S.patience,
      color: T.color || (T.colors ? rng.pick(T.colors) : '#FFFFFF'), icon: T.icon || '', state: 'normal', committed: false, cleared: false,
      stall: 0, stallDone: false, ambWait: 0, group: null, fume: 0, creep: 0, revved: false, x: 0, y: 0, ang: LANES[li].ang, dead: false,
    };
    place(c); S.cars.push(c); return c;
  }
  function place(c) { if (!inLane(c)) return; const L = LANES[c.lane]; c.x = L.x + L.dx * c.t; c.y = L.y + L.dy * c.t; }
  function laneClear(li, minT) { return !S.cars.some(c => c.lane === li && inLane(c) && (c.t - c.len / 2) < minT); }
  function spawnOne() {
    const type = S.forceType || rng.weighted(weights); S.forceType = null;
    const li = rng.int(4);
    if (type === 'cortege') {
      if (!laneClear(li, 400)) return false;
      const g = { left: 5, failed: false };
      for (let i = 0; i < 5; i++) { const c = mk(i === 0 ? 'limo' : 'wcar', li, -i * 72); c.group = g; if (i === 2) c.icon = '🎀'; if (i === 4) c.icon = '🥂'; }
      emit('tag', { li, text: '💒 Кортеж' }); emit('sfx', 'chorus'); return true;
    }
    if (type === 'goose') {
      if (!laneClear(li, 150)) return false;
      for (let i = 0; i < 3; i++) mk('goose', li, -i * 32);
      emit('tag', { li, text: '🦆 Гуси' }); return true;
    }
    if (!laneClear(li, 80)) return false;
    mk(type, li, 0);
    if (type === 'amb') { emit('tag', { li, text: '🚑 Скорая!' }); emit('sfx', 'siren'); }
    if (type === 'cow') emit('tag', { li, text: '🐄 Корова' });
    if (type === 'clown') emit('tag', { li, text: '🤡 Клоун' });
    return true;
  }
  // разрыв кортежа: невеста уходит пешком
  function breakCortege(g, near) {
    if (!g || g.failed) return; g.failed = true;
    const limo = S.cars.find(c => c.group === g && c.type === 'limo' && !c.dead) || near;
    if (!limo) return;
    const L = LANES[limo.lane];
    const side = L.dx === 0 ? { vx: L.x < C.x ? -38 : 38, vy: 0 } : { vx: 0, vy: L.y < C.y ? -38 : 38 };
    emit('walker', { e: '👰', x: limo.x, y: limo.y, vx: side.vx, vy: side.vy, life: 5, say: 'Я ПЕШКОМ!' });
  }
  function removeCar(c) { c.dead = true; if (c.group) breakCortege(c.group, c); }
  function startFume(c) {
    c.state = 'fuming'; c.fume = FUME;
    emit('text', { x: c.x, y: c.y - 40, t: rng.pick(INSULTS), color: '#FF3B30', size: 15, life: 1.3 });
    emit('sfx', 'honk'); emit('buzz', 30);
  }
  function rage(c) {
    if (c.group) breakCortege(c.group, c);
    if (!c.group && RAM_TYPES[c.type]) {
      c.state = 'ram'; c.v = 0; c.ang = Math.atan2(C.y - c.y, C.x - c.x);
      emit('text', { x: c.x, y: c.y - 34, t: 'ТЕБЕ КОНЕЦ!', color: '#FF3B30', size: 17, life: 1.2 });
    } else {
      c.state = 'run'; c.committed = true;
      emit('text', { x: c.x, y: c.y - 34, t: c.type === 'taxi' ? 'Я ЗНАЮ КОРОТКИЙ ПУТЬ!' : 'ПРОРЫВАЮСЬ!', color: '#FF3B30', size: 16, life: 1.3 });
    }
    emit('sfx', 'rev');
  }
  function crash(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    removeCar(a); removeCar(b);
    emit('crash', { a: Object.assign({}, a), b: Object.assign({}, b), x: mx, y: my });
    S.stats.crashes++;
    const why = `${cap(NAME[a.type])} и ${NAME[b.type]} не поделили перекрёсток`;
    if (o.goal && o.goal.noCrash) { S.lives = 0; finish(false, 'Начальник видел ДТП из кустов. ' + why); return; }
    loseLife(why);
  }
  function loseLife(reason) { S.reason = reason; S.lives--; if (S.lives <= 0) finish(false, reason); }

  /* ---------- силы ---------- */
  function canUse(kind) { return kind === 'evac' ? S.powers.evac > 0 : S.zenCD <= 0; }
  function calm(c) { c.anger = 0; if (c.state === 'fuming') c.state = 'normal'; }
  function laneAt(x, y) { const dx = x - C.x, dy = y - C.y; return Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 0 : 1) : (dx < 0 ? 2 : 3); }
  function applyPower(kind, x, y) {
    if (S.over || !canUse(kind)) return false;
    if (kind === 'evac') {
      let bc = null, bd = 50;
      for (const c of S.cars) { if (c.dead) continue; const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; bc = c; } }
      if (!bc) return false;
      S.powers.evac--; S.used.evac++; removeCar(bc);
      emit('evac', { x: bc.x, y: bc.y });
    } else {
      const li = laneAt(x, y), calmed = [];
      for (const c of S.cars) if (c.lane === li && (c.state === 'normal' || c.state === 'fuming')) { calm(c); calmed.push({ x: c.x, y: c.y }); }
      S.zenCD = S.zenMax;
      emit('zen', { x, y, calmed });
    }
    return true;
  }
  function useSiren() {
    if (S.over || S.powers.siren <= 0 || S.frozen > 0) return false;
    S.powers.siren--; S.used.siren++; S.frozen = 4;
    emit('sfx', 'siren'); emit('banner', { title: '🚨 Сирена', sub: 'Все замерли', ms: 1400 });
    return true;
  }
  function useDonut() {
    if (S.over || S.powers.donut <= 0) return false;
    S.powers.donut--; S.used.donut++;
    const calmed = [];
    for (const c of S.cars) if ((c.state === 'normal' || c.state === 'fuming') && c.anger > 0) { calm(c); calmed.push({ x: c.x, y: c.y }); }
    emit('donut', { calmed });
    return true;
  }
  function awardBonus() {
    const k = rng.pick(['evac', 'siren', 'donut', 'donut', 'life']);
    if (k === 'life' && S.lives < S.maxLives) { S.lives++; emit('banner', { title: '🎁 Премия', sub: '+❤️', ms: 1400 }); }
    else { const kk = k === 'life' ? 'donut' : k; S.powers[kk]++; emit('banner', { title: '🎁 Премия', sub: '+' + ({ evac: '🏗️', siren: '🚨', donut: '🍩' })[kk], ms: 1400 }); }
    emit('sfx', 'ding');
  }

  /* ---------- светофор с жёлтой паузой ---------- */
  const targetAxis = () => S.green === -1 ? S.pending : S.green;
  function setAxis(ax) {
    if (S.over || S.green === ax) return;
    if (S.green === -1) {
      if (ax === S.prev) { S.green = ax; S.pending = -1; S.amber = 0; emit('axis', { cancel: true }); }   // передумал — мгновенно назад
      return;
    }
    S.prev = S.green; S.pending = ax; S.green = -1; S.amber = 0;
    emit('axis', { cancel: false });
  }
  function boxBusy(axis) {
    return S.cars.some(c => !c.dead && inLane(c) && LANES[c.lane].axis === axis &&
      c.t + c.len / 2 > LANES[c.lane].boxStartT - 2 && c.t - c.len / 2 < LANES[c.lane].boxEndT);
  }
  // тап по дороге: какую ось открыть
  function tapRoad(x, y) {
    const dx = x - C.x, dy = y - C.y;
    const inV = Math.abs(dx) < R, inH = Math.abs(dy) < R;
    setAxis(inV && !inH ? 0 : inH && !inV ? 1 : 1 - targetAxis());
  }

  /* ---------- волны движения ---------- */
  function wave() {
    const t = S.time % 30;
    if (t < 7) return ['calm', 1.5];
    if (t < 18) return ['build', 1];
    if (t < 25) return ['rush', .62];
    return ['rest', 2.1];
  }

  /* ---------- шаг ---------- */
  function step(dt) {
    if (S.over) return;
    S.time += dt;
    const d = Math.min(1, S.time / 180), mult = 1 + d * .5;
    if (S.zenCD > 0) S.zenCD = Math.max(0, S.zenCD - dt);
    if (S.green === -1) {
      S.amber += dt;
      if ((S.amber >= AMBER_MIN && !boxBusy(S.prev)) || S.amber >= AMBER_MAX) { S.green = S.pending; S.pending = -1; emit('sfx', 'amber'); }
    }
    const stopped = S.frozen > 0;
    if (stopped) S.frozen -= dt;
    else {
      S.score += dt;
      const [ph, k] = wave();
      if (ph !== S.phase) {
        S.phase = ph;
        if (ph === 'rush' && S.time > 5) {
          const sp = ['amb', 'cortege', 'cow', 'clown', 'bus'].filter(t => weights[t]);
          if (sp.length) S.forceType = rng.pick(sp);
          emit('banner', { title: '🚦 Наплыв!', sub: '', ms: 1100 });
        }
      }
      S.spawnT -= dt;
      if (S.spawnT <= 0) { const ok = spawnOne(); const iv = (2 - .9 * d) * S.spawnMul * k; S.spawnT = ok ? iv * (.6 + rng.next() * .8) : .3; }
      moveCars(dt, mult);
      chorus(dt);
    }
    // тараны и сбежавшие
    for (const c of S.cars) {
      if (c.dead || stopped) continue;
      if (c.state === 'escape') {
        c.x += Math.cos(c.ang) * 300 * dt; c.y += Math.sin(c.ang) * 300 * dt;
        if (c.x < -120 || c.x > W + 120 || c.y < -120 || c.y > H + 120) c.dead = true;
        continue;
      }
      if (c.state !== 'ram' || S.over) continue;
      const dx = C.x - c.x, dy = C.y - c.y, dist = Math.hypot(dx, dy);
      c.ang = Math.atan2(dy, dx); c.v = Math.min(270, c.v + 420 * dt);
      c.x += dx / dist * c.v * dt; c.y += dy / dist * c.v * dt;
      if (dist < 22) {
        c.state = 'escape';
        emit('copHit', { type: c.type });
        loseLife(RAM_REASON[c.type] || 'Тебя сбили');
      }
    }
    if (!stopped && !S.over) for (let i = 0; i < S.cars.length; i++) {
      const a = S.cars[i]; if (!inLane(a)) continue;
      for (let j = i + 1; j < S.cars.length; j++) {
        const b = S.cars[j]; if (!inLane(b)) continue;
        if (LANES[a.lane].axis === LANES[b.lane].axis) continue;
        if (overlap(a, b)) { crash(a, b); break; }
      }
    }
    S.cars = S.cars.filter(c => !c.dead);
    if (!S.over && S.score >= S.nextBonus) { S.nextBonus += S.bonusEvery; awardBonus(); }
    const p = progress();
    if (p && p.done && !S.over) finish(true, '');
  }
  // свадьба сигналит хором, когда стоит
  function chorus(dt) {
    S.chorusT -= dt; if (S.chorusT > 0) return;
    const c = S.cars.find(x => x.group && !x.group.failed && x.v < 8 && x.anger > 35 && x.state === 'normal');
    if (c) { emit('chorus', { cars: S.cars.filter(x => x.group === c.group).map(x => ({ x: x.x, y: x.y })) }); S.chorusT = 1.6; }
    else S.chorusT = .4;
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
      const list = S.cars.filter(c => c.lane === li && inLane(c)).sort((a, b) => b.t - a.t);
      const red = L.axis !== S.green;
      for (let i = 0; i < list.length; i++) {
        const c = list[i], leader = list[i - 1], T = TYPES[c.type];
        const front = c.t + c.len / 2;
        // таксист подползает за стоп-линию
        if (c.type === 'taxi' && red && c.v < 10) c.creep = Math.min(14, c.creep + dt * (2 + c.anger * .05));
        else if (!red) c.creep = 0;
        if (c.creep > 7 && !c.revved) { c.revved = true; emit('text', { x: c.x, y: c.y - 34, t: 'врррм…', color: '#E6EAF2', size: 12, life: 1 }); emit('sfx', 'rev'); }
        let dist = Infinity;
        if (leader) dist = (leader.t - leader.len / 2) - front - 10;
        const dLine = L.stopT + c.creep - front;
        if (red && c.state !== 'run' && !c.committed && dLine > -1) {
          if (dLine < c.v * c.v / (2 * BR * 1.5) && c.v > 20) c.committed = true;
          else dist = Math.min(dist, dLine);
        }
        const queued = front < L.stopT + 4 + c.creep;
        if ((T.stalls || T.stare) && !c.stallDone && Math.abs(c.t - L.centerT) < 10) {
          c.stallDone = true;
          if (T.stare) { c.stall = 2.2; emit('text', { x: c.x, y: c.y - 30, t: 'МУ.', color: '#fff', size: 16, life: 1.4 }); emit('sfx', 'moo'); }
          else { c.stall = 2.8; emit('text', { x: c.x, y: c.y - 30, t: 'ЗАГЛОХ!', color: '#FF5FAE', size: 16, life: 1.4 }); emit('burst', { x: c.x, y: c.y, e: '💨', n: 2 }); }
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
          if (c.anger >= 100) startFume(c);
        } else if (c.state === 'fuming') {
          c.fume -= dt;
          if (c.v > 25) { c.state = 'normal'; c.anger = 70; }       // поехал — остыл
          else if (c.fume <= 0) rage(c);
        }
        if (c.type === 'amb') {
          if (queued && c.v < 8) c.ambWait += dt; else c.ambWait = Math.max(0, c.ambWait - dt * .5);
          if (c.ambWait > AMB_LIMIT) {
            c.dead = true;
            emit('ambLate', { x: c.x, y: c.y, vx: (L.dx === 0 ? (L.x < C.x ? -30 : 30) : 0), vy: (L.dx ? (L.y < C.y ? -30 : 30) : 0) });
            loseLife('Скорая опоздала. Пациент ушёл пешком');
          }
        }
        if (!c.cleared && c.t - c.len / 2 > L.boxEndT) {
          c.cleared = true;
          if (c.state === 'normal' || c.state === 'fuming') {
            S.score += T.pts; S.stats.cars++;
            if (c.type === 'amb') S.stats.amb++;
            if (c.type === 'cow') S.stats.cow++;
            if (c.type === 'taxi') S.stats.taxi++;
            emit('passed', { x: c.x, y: c.y, type: c.type, pts: T.pts });
            if (c.group) {
              c.group.left--;
              if (c.group.left === 0 && !c.group.failed) { S.score += 150; S.stats.cortege++; emit('cortegeDone', { x: C.x, y: C.y }); }
            }
          }
        }
        if (c.t - c.len / 2 > L.total) c.dead = true;
      }
    }
  }

  return {
    S, C, LANES, H, theme: THEMES[o.theme] || THEMES.wedding, weights,
    on: f => listeners.push(f),
    step, progress, setAxis, targetAxis, tapRoad, laneAt, canUse, applyPower, useSiren, useDonut, inLane,
    AMB_LIMIT,
  };
}
