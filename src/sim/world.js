/* ============ СТОП! — симуляция смены ============
   Правила игры без графики: транспорт и его состояния, сигналы по направлениям,
   ConflictResolver, водители, события, метрики (ошибки, хаос, терпение), очки, победа/поражение.
   Наружу — только события через on(). Шаг времени фиксированный (задаёт вызывающий). */
import { VEHICLES, CHARACTERS, LINES } from '../config/vehicles.js';
import { MAPS } from '../config/maps.js';
import { EVENTS, MODIFIERS } from '../config/events.js';
import { SCORE } from '../config/economy.js';
import { EXTRA_TEXT } from '../config/texts.js';
import { buildGeometry, pos, OFF, OPP } from './roadgraph.js';
import { createResolver } from './resolver.js';
import { createRng } from './rng.js';

export const W = 490;
// ширина видимого мира: узкие карты показываем крупнее
export const worldWidth = mapId => (MAPS[mapId].v + MAPS[mapId].h > 2 ? 460 : 400);
export const STEP = 1 / 60;
export const FUME = 1.4;           // предупреждение перед нарушением, сек
export const PREPARE_T = 1.1;      // жёлтый: новые манёвры не начинаются
const GAP = 8, MAX_CARS = 42, LINE_GLOBAL_CD = 2.6;
const ON_PATH = new Set(['SPAWNING', 'MOVING', 'APPROACHING', 'WAITING', 'CHECKING', 'YIELDING', 'CROSSING', 'TURNING', 'EMERGENCY', 'BLOCKED', 'MANUAL_CONTROL', 'BROKEN']);

export function createWorld(level, o = {}) {
  const H = o.H || 860, WW = o.W || W;
  const geo = buildGeometry(MAPS[level.map], WW, H);
  const rng = createRng(o.seed ?? 1);
  const res = createResolver(geo);
  const listeners = [];
  const emit = (type, d) => { for (const f of listeners) f(type, d); };
  const spawnCfg = level.spawn || {};
  const approaches = (spawnCfg.approaches || geo.arms).filter(a => geo.arms.includes(a));
  const endless = level.goal?.type === 'endless';
  const mods = new Set([...(level.modifiers || []), ...(o.modifiers || [])]);
  const tempMods = new Map();                 // временные модификаторы событий (дождь)
  const closed = new Set();                   // закрытые выезды (ремонт)
  if (mods.has('repair')) closed.add(pickClosedSide());

  // ---------- состояние ----------
  const sig = {};
  for (const A of geo.arms) sig[A] = { state: 'STOP', t: 0 };
  const first = approaches[0];
  sig[first].state = 'GO';
  if (!level.tutorial && sig[OPP[first]] && geo.compatible(first, OPP[first])) sig[OPP[first]].state = 'GO';

  const S = {
    time: 0, score: 0, errors: 0, maxErrors: level.maxErrors || 3, over: false, win: false, reason: '', stars: 0,
    chaos: 0, maxChaos: 0, chaosCrit: 0, patience: 100, patienceSum: 0, patienceTime: 0, lowPatience: 0,
    frozen: 0, whistleCd: 0, zenCd: 0, siren: o.siren ?? 1, donut: o.donut ?? 1, whistleUses: 0,
    stats: { passed: 0, byType: {}, turns: 0, crashes: 0, violations: 0, waitSum: 0, waitN: 0, maxLaneQueue: 0, eventTasksDone: 0, eventTasksFailed: 0 },
    tasks: [], clearHold: 0, phase: 'calm', glitchT: 0, lineCd: 3,
  };
  const cars = [];
  const pending = [];
  let uid = 0, nextSpawn = 1.2, nextEvent = eventInterval();
  const lastEvent = {}, active = new Map();   // id → { until }
  const groups = [];

  /* ---------- модификаторы ---------- */
  function mod(key) {
    let v = 1;
    for (const m of mods) { const M = MODIFIERS[m]; if (M && typeof M[key] === 'number') v *= M[key]; }
    for (const m of tempMods.keys()) { const M = MODIFIERS[m]; if (M && typeof M[key] === 'number') v *= M[key]; }
    return v;
  }
  const hasMod = m => mods.has(m) || tempMods.has(m);

  /* ---------- сигналы (STOP / PREPARE / GO) ---------- */
  function setSignal(A, st) {
    const s = sig[A]; if (!s || S.over) return;
    if (st === 'GO' && s.state !== 'GO') { s.state = 'GO'; emit('signal', { A, state: 'GO' }); }
    else if (st === 'STOP' && s.state === 'GO') { s.state = 'PREPARE'; s.t = PREPARE_T; emit('signal', { A, state: 'PREPARE' }); }
  }
  const toggleSignal = A => setSignal(A, sig[A]?.state === 'GO' ? 'STOP' : 'GO');
  function permitted(c) {
    if (c.emergency || c.escort || c.manualGo) return true;
    const st = sig[c.path.approach].state;
    return st === 'GO' || (st === 'PREPARE' && c.ch.ignoresPrepare && c.path.sStop - (c.s + c.len / 2) < 30);
  }

  /* ---------- транспорт ---------- */
  function routeFor(A, k, want) {
    let opts = geo.pathsFrom(A, k);
    const open = opts.filter(p => !closed.has(p.exitSide));
    if (open.length && rng.next() < .75) opts = open;
    const byMove = m => opts.find(p => p.move === m);
    if (want && byMove(want)) return byMove(want);
    const r = spawnCfg.routes || { S: .6, R: .22, L: .18 };
    const w = {}; for (const p of opts) w[p.move] = (r[p.move] || 0) + 1e-6;
    return byMove(rng.weighted(w)) || opts[0];
  }
  function laneClearAt(entryKey, len) {
    for (const c of cars) if (!c.dead && c.path && c.path.entryKey === entryKey && !c.free && c.s - c.len / 2 < len + GAP + 4) return false;
    return true;
  }
  function makeCar(type, path, ex = {}) {
    const V = VEHICLES[type];
    const charId = ex.char || rng.weighted(V.chars || { calm: 1 });
    const ch = CHARACTERS[charId];
    const c = {
      id: ++uid, type, V, char: charId, ch, path, s: ex.s ?? 0, len: V.len, wid: V.wid,
      vmax: V.vmax * (.93 + rng.next() * .14) * (ch.speed || 1), accel: V.accel * (ch.accel || 1), brake: V.brake,
      color: ex.color || V.color || rng.pick(V.colors), icon: ex.icon || '', state: 'SPAWNING', granted: false, cleared: false, dead: false,
      wait: 0, totalWait: 0, anger: ex.anger || 0, fuming: false, fume: 0, fumeCd: 0, violation: false, manualGo: false,
      emergency: !!V.emergency, escort: !!ex.escort, group: ex.group || null, hes: 0, stall: 0, stallDone: false, creep: 0, revved: false,
      lineCd: 3 + rng.next() * 5, cells: [], x: 0, y: 0, ang: 0, v: 0, spawnedAt: S.time, visibleAt: null,
    };
    c.v = ex.s > 0 ? 0 : c.vmax * .8;
    const p = pos(path, c.s); c.x = p.x; c.y = p.y; c.ang = p.ang;
    cars.push(c);
    if (c.group) c.group.ids.push(c.id);
    return c;
  }
  function trySpawn(req) {
    const A = req.A || rng.pick(approaches);
    const lanes = geo.lanesOf(A);
    const k = req.lane ?? (req.move === 'R' ? lanes - 1 : req.move === 'L' ? 0 : rng.int(lanes));
    const path = routeFor(A, k, req.move);
    if (!path) return null;
    const len = VEHICLES[req.type].len;
    if (!laneClearAt(path.entryKey, len)) return null;
    return makeCar(req.type, path, req);
  }
  function spawnRandom() {
    if (cars.filter(c => !c.dead).length >= MAX_CARS) return false;
    const type = rng.weighted(spawnCfg.mix || { car: 1 });
    const angry = S.angryNext;
    const c = trySpawn({ type, ...(angry ? { char: 'aggressive', anger: 45 } : {}) });
    if (c && angry) { S.angryNext = false; emit('say', { id: c.id, text: rng.pick(LINES.aggressive) }); }
    return !!c;
  }
  function preload(n) {
    for (const A of approaches) for (let k = 0; k < geo.lanesOf(A); k++) {
      let s = null;
      for (let i = 0; i < n; i++) {
        const type = rng.weighted(spawnCfg.mix || { car: 1 });
        const len = VEHICLES[type].len;
        const path = routeFor(A, k);
        if (s === null) s = path.sStop - len / 2 - 1; else s -= len + GAP + 2;
        if (s < len / 2) break;
        const c = makeCar(type, path, { s, anger: 20 + rng.next() * 30 });
        c.state = 'WAITING';
      }
    }
  }
  if (spawnCfg.preload) preload(spawnCfg.preload);

  /* ---------- события ---------- */
  function eventInterval() { const e = level.eventEvery || [14, 24]; return e[0] + rng.next() * (e[1] - e[0]); }
  function pickClosedSide() { const s = geo.arms.filter(a => a !== approaches[0]); return s[Math.floor((o.seed || 1) % s.length)] || geo.arms[0]; }
  const eventPool = () => {
    const list = [...(level.events || [])];
    for (const m of mods) { const M = MODIFIERS[m]; if (M?.events) list.push(...M.events); }
    return list;
  };
  function tickEvents(dt) {
    for (const [id, a] of active) if (a.until !== undefined && S.time >= a.until) { endEvent(id); active.delete(id); }
    if (level.tutorial) return;
    nextEvent -= dt;
    if (nextEvent > 0) return;
    nextEvent = eventInterval();
    const pool = eventPool();
    const w = {};
    for (const id of pool) {
      const E = EVENTS[id]; if (!E) continue;
      if (S.time < E.minTime || (lastEvent[id] !== undefined && S.time - lastEvent[id] < E.cooldown)) continue;
      if ((E.excl || []).some(x => active.has(x))) continue;
      w[id] = (w[id] || 0) + E.weight;
    }
    const ids = Object.keys(w); if (!ids.length) return;
    startEvent(rng.weighted(w));
  }
  function addTask(t) { const task = Object.assign({ state: 'active', t: 0 }, t); S.tasks.push(task); emit('task', task); return task; }
  function completeTask(task, ok) {
    if (task.state !== 'active') return;
    task.state = ok ? 'done' : 'failed';
    if (ok) { S.stats.eventTasksDone++; S.score += task.reward || 0; } else S.stats.eventTasksFailed++;
    emit('taskEnd', task);
  }
  function startEvent(id) {
    const E = EVENTS[id];
    lastEvent[id] = S.time;
    const A = rng.pick(approaches);
    const from = { N: 'с севера', S: 'с юга', W: 'с запада', E: 'с востока' }[A];
    switch (id) {
      case 'ambulance': {
        const task = addTask({ ev: id, icon: E.icon, text: E.task, deadline: E.deadline, reward: E.reward, cars: [] });
        pending.push({ type: 'amb', A, move: 'S', task });
        emit('event', { id, A, text: `${E.icon} ${E.name} ${from}` }); emit('sfx', 'siren'); break;
      }
      case 'breakdown': {
        const cand = cars.filter(c => !c.dead && !c.free && !c.emergency && !c.group && !c.cleared && c.state !== 'BROKEN' &&
          ((c.granted && c.s > c.path.sBoxIn + 4 && c.s < c.path.sBoxOut - 4) || (!c.granted && c.state === 'WAITING')));
        if (!cand.length) { lastEvent[id] = S.time - E.cooldown + 6; return; }
        const c = rng.pick(cand);
        breakDown(c);
        addTask({ ev: id, icon: E.icon, text: E.task, deadline: E.deadline, reward: E.reward, carId: c.id });
        emit('event', { id, A: c.path.approach, text: `${E.icon} Поломка! Тапни машину → эвакуатор` }); break;
      }
      case 'wedding': case 'vip': {
        const g = { kind: id, ids: [], failed: false, done: false };
        groups.push(g);
        g.task = addTask({ ev: id, icon: E.icon, text: E.task, reward: E.reward, group: g });
        const move = rng.next() < .7 ? 'S' : 'R';
        const lane = move === 'R' ? geo.lanesOf(A) - 1 : 0;
        if (id === 'wedding') {
          pending.push({ type: 'limo', A, move, lane, group: g, icon: '👰' });
          for (let i = 0; i < 4; i++) pending.push({ type: 'wcar', A, move, lane, group: g, icon: ['🤵', '🎀', '💐', '🥂'][i] });
        } else {
          pending.push({ type: 'police', A, move, lane, group: g, escort: true });
          for (let i = 0; i < 2; i++) pending.push({ type: 'vip', A, move, lane, group: g, escort: true });
        }
        emit('event', { id, A, text: `${E.icon} ${E.name} ${from}` }); break;
      }
      case 'rain': tempMods.set('rain', S.time + E.duration); active.set(id, { until: S.time + E.duration }); emit('event', { id, text: '🌧️ Дождь: тормозной путь длиннее' }); emit('weather', { rain: true }); break;
      case 'repair': {
        const side = rng.pick(geo.arms.filter(a => !closed.has(a)));
        closed.add(side);
        active.set(id, { until: S.time + E.duration, side });
        addTask({ ev: id, icon: E.icon, text: E.task, reward: E.reward, side });
        emit('event', { id, side, text: `🚧 Ремонт: выезд закрыт. Остальных — в объезд` }); emit('closed', { sides: [...closed] }); break;
      }
      case 'angry': S.angryNext = true; emit('event', { id, text: '😤 Едет агрессивный водитель' }); break;
      case 'jam': for (let i = 0; i < 5; i++) pending.push({ type: rng.weighted(spawnCfg.mix || { car: 1 }), A }); emit('event', { id, A, text: `🚗 Наплыв машин ${from}` }); break;
      case 'cow': pending.push({ type: 'cow', A, move: 'S' }); emit('event', { id, A, text: `🐄 Корова ${from}` }); break;
      case 'clown': pending.push({ type: 'clown', A, move: 'S' }); emit('event', { id, A, text: `🤡 Клоун-кар ${from}. Он заглохнет` }); break;
    }
  }
  function endEvent(id) {
    if (id === 'rain') { tempMods.delete('rain'); emit('weather', { rain: false }); }
    if (id === 'repair') {
      const a = active.get(id); closed.delete(a.side); emit('closed', { sides: [...closed] });
      const t = S.tasks.find(x => x.ev === 'repair' && x.state === 'active');
      const stuck = cars.some(c => !c.dead && !c.granted && c.path && c.path.exitSide === a.side && c.wait > 3);
      if (t) completeTask(t, !stuck);
    }
  }
  function tickTasks(dt) {
    for (const t of S.tasks) {
      if (t.state !== 'active') continue;
      t.t += dt;
      if (t.ev === 'ambulance') {
        const c = cars.find(x => t.cars.includes(x.id));
        if (c && c.cleared) completeTask(t, true);
        else if (c && c.visibleAt !== null && S.time - c.visibleAt > t.deadline) {
          completeTask(t, false); addError('Скорая опоздала. Пациент ушёл пешком', 'amb', c);
        }
      } else if (t.ev === 'breakdown') {
        if (!cars.some(c => c.id === t.carId && !c.dead)) completeTask(t, true);
        else if (t.t > t.deadline) { completeTask(t, false); S.score += SCORE.block; emit('text', { x: geo.C.x, y: geo.C.y - 60, t: 'Пробка из-за поломки −30', color: '#FF3B30' }); }
      } else if (t.group) {
        const g = t.group;
        if (g.failed) completeTask(t, false);
        else if (g.ids.length && g.ids.every(id => { const c = cars.find(x => x.id === id); return !c || c.cleared; }) && !pending.some(p => p.group === g)) {
          g.done = true; completeTask(t, true); emit('groupDone', { kind: g.kind });
        }
      }
    }
  }
  function processPending() {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      // члены колонны — строго по порядку
      if (p.group && pending.slice(0, i).some(q => q.group === p.group)) continue;
      const c = trySpawn(p);
      if (c) {
        if (p.task) p.task.cars.push(c.id);
        pending.splice(i, 1); i--;
      }
    }
  }

  /* ---------- происшествия ---------- */
  const obstacles = () => cars.filter(c => !c.dead && (c.state === 'WRECK' || c.state === 'BROKEN' || c.state === 'TOW'));
  function breakDown(c) {
    c.state = 'BROKEN'; c.v = 0; c.broken = true; c.obR = Math.max(c.len, c.wid) / 2;
    if (c.group) breakGroup(c.group, c);
    emit('broken', { id: c.id, x: c.x, y: c.y });
  }
  function addError(reason, kind, at) {
    S.errors++; S.reason = reason;
    emit('error', { reason, kind, x: at?.x, y: at?.y, errors: S.errors, max: S.maxErrors });
    if (S.errors >= S.maxErrors) finish(false, reason);
  }
  function crash(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    for (const c of [a, b]) {
      if (c.group) breakGroup(c.group, c);
      res.release(c); res.unclaim(c);
      c.state = 'WRECK'; c.free = true; c.v = 0; c.violation = false; c.granted = true; c.wreckAt = S.time; c.critical = false;
      c.obR = Math.max(c.len, c.wid) / 2;
      res.occupy(c, c.x, c.y, c.len / 2 + 4);
    }
    S.stats.crashes++; S.score += SCORE.crash;
    const name = t => VEHICLES[t].name.toLowerCase();
    const why = `${VEHICLES[a.type].name} и ${name(b.type)} не поделили перекрёсток`;
    emit('crash', { a: snap(a), b: snap(b), x: mx, y: my });
    if (level.failOnCrash) { S.errors = S.maxErrors; finish(false, 'Авария. Испытание провалено'); return; }
    addError(why, 'crash', { x: mx, y: my });
  }
  const snap = c => ({ id: c.id, type: c.type, x: c.x, y: c.y, ang: c.ang, color: c.color, len: c.len, wid: c.wid, icon: c.icon });
  function breakGroup(g, near) {
    if (g.failed || g.done) return;
    g.failed = true;
    if (g.kind === 'wedding') {
      const limo = cars.find(c => g.ids.includes(c.id) && c.type === 'limo' && !c.dead) || near;
      if (limo) emit('walker', { e: '👰', x: limo.x, y: limo.y, ang: limo.ang + Math.PI / 2, say: 'Я ПЕШКОМ!' });
    } else emit('say', { id: near?.id, text: 'Вы знаете, кто я?!' });
  }

  /* ---------- шаг машины ---------- */
  const brakeDist = c => c.v * c.v / (2 * c.brake * mod('brake'));
  function isFirst(c) {
    for (const o of cars) if (o !== c && !o.dead && o.path && !o.free && o.path.entryKey === c.path.entryKey && !o.granted && o.s > c.s) return false;
    return true;
  }
  function stepCar(c, dt, intensity) {
    const P = c.path, front = c.s + c.len / 2;
    if (c.state === 'BROKEN') { c.v = 0; return; }
    if (c.state === 'TOW') { c.towT -= dt; if (c.towT <= 0) removeCar(c); return; }
    if (c.visibleAt === null && c.s > OFF * .7) c.visibleAt = S.time;
    // 1) кто впереди
    let gap = Infinity;
    for (const o of cars) {
      if (o === c || o.dead || !o.path || o.free) continue;
      if (o.path.entryKey === P.entryKey && o.s > c.s) {
        if (o.s - o.len / 2 < o.path.sBoxOut + 2 || o.path.exitKey === P.exitKey) gap = Math.min(gap, (o.s - o.len / 2) - front - GAP);
      }
      if (c.granted && o.granted && o.path.exitKey === P.exitKey) {
        const dO = o.s - o.path.sBoxOut, dC = c.s - P.sBoxOut;
        if (dO > dC) gap = Math.min(gap, (dO - o.len / 2) - (dC + c.len / 2) - GAP);
      }
    }
    // препятствия на траектории (обломки, сломанные машины)
    for (const ob of obstacles()) {
      if (ob === c) continue;
      for (let s2 = front; s2 < front + 90; s2 += 4) {
        const p = pos(P, s2);
        if (Math.hypot(p.x - ob.x, p.y - ob.y) < ob.obR + c.wid / 2) { gap = Math.min(gap, s2 - front - 4); break; }
      }
    }
    // 2) стоп-линия и разрешение на въезд
    if (!c.granted) {
      if (c.ch.creeps && sig[P.approach].state !== 'GO' && c.v < 3 && isFirst(c)) {
        c.creep = Math.min(12, c.creep + dt * (2 + c.anger * .05));
        if (c.creep > 7 && !c.revved) { c.revved = true; emit('say', { id: c.id, text: 'врррм…' }); emit('sfx', 'rev'); }
      }
      const stopS = front > P.sStop + c.creep + 1 ? P.sBoxIn - 1 : P.sStop + c.creep;
      const dLine = stopS - front;
      let go = false;
      if (dLine < brakeDist(c) + 10 || (c.v < 1 && dLine < 8)) {
        if (permitted(c)) {
          c.state = 'CHECKING';
          const bl = res.blockers(c), exitOk = res.exitFree(c, cars, closed);
          if (!bl.length && exitOk) { grant(c); go = true; }
          else {
            c.state = (!exitOk && closed.has(P.exitSide)) || bl.some(b => b.obstacle || b.state === 'BROKEN') ? 'BLOCKED' : 'YIELDING';
            c.exitBlocked = !exitOk;
            c.conflictGreen = sig[P.approach].state === 'GO' && bl.some(b => b.path && !b.obstacle && !geo.compatible(b.path.approach, P.approach) && sig[b.path.approach]?.state === 'GO');
          }
        } else { c.state = c.v < 3 ? 'WAITING' : 'APPROACHING'; c.conflictGreen = false; }
      } else { c.state = c.emergency ? 'EMERGENCY' : (c.s < OFF ? 'SPAWNING' : dLine < 170 ? 'APPROACHING' : 'MOVING'); c.conflictGreen = false; }
      if (!go) gap = Math.min(gap, dLine);
      if (c.emergency && dLine < 240 && c.visibleAt !== null) res.claim(c);
    }
    // 3) скорость
    const vm = c.vmax * mod('vmax') * (c.violation ? 1.25 : 1), br = c.brake * mod('brake'), acc = c.accel * mod('accel');
    let vd = Math.min(vm, Math.sqrt(2 * br * Math.max(gap, 0)) * .85);
    if (c.hes > 0) { c.hes -= dt; vd = 0; }
    if (c.stall > 0) { c.stall -= dt; vd = 0; }
    c.v = vd > c.v ? Math.min(vd, c.v + acc * dt) : Math.max(vd, c.v - br * 1.6 * dt);
    c.s += c.v * dt;
    const p = pos(P, c.s); c.x = p.x; c.y = p.y; c.ang = p.ang;
    if (c.granted && !c.violation) res.progress(c);
    // заглохнуть / постоять посреди перекрёстка
    if ((c.V.stalls || c.V.stare) && !c.stallDone && c.granted && c.s > (P.sBoxIn + P.sBoxOut) / 2) {
      c.stallDone = true; c.stall = c.V.stare ? 2.2 : 2.8;
      emit('say', { id: c.id, text: c.V.stare ? 'МУ.' : 'ЗАГЛОХ!' }); emit('sfx', c.V.stare ? 'moo' : 'pop');
    }
    if (c.granted && !c.cleared && c.state !== 'CROSSING' && c.state !== 'TURNING' && !c.violation) c.state = P.move === 'S' ? 'CROSSING' : 'TURNING';
    // 4) проехал перекрёсток
    if (c.granted && !c.cleared && c.s - c.len / 2 > P.sBoxOut) {
      c.cleared = true; res.release(c); c.state = 'MOVING';
      if (!c.violation) passed(c); else c.violation = false;
    }
    if (c.s - c.len / 2 > P.total) removeCar(c, true);
    // 5) настроение
    mood(c, dt, intensity);
  }
  function grant(c) {
    const wasStopped = c.v < 3;
    c.granted = true; c.manualGo = false; c.exitBlocked = false; c.conflictGreen = false;
    res.reserve(c); res.unclaim(c);
    c.state = c.path.move === 'S' ? 'CROSSING' : 'TURNING';
    if (c.fuming) { c.fuming = false; c.anger = 70; }
    if (wasStopped && c.ch.hesitate) c.hes = c.ch.hesitate;
    // кортеж: если предыдущий уже уехал, а этот стоял — колонна разорвана
  }
  function passed(c) {
    const pts = (VEHICLES[c.type].pts || SCORE.car) + (c.path.move !== 'S' ? SCORE.turn : 0);
    S.score += pts; S.stats.passed++;
    S.stats.byType[c.type] = (S.stats.byType[c.type] || 0) + 1;
    if (c.path.move !== 'S') S.stats.turns++;
    S.stats.waitSum += c.totalWait; S.stats.waitN++;
    emit('passed', { id: c.id, x: c.x, y: c.y, type: c.type, pts });
  }
  function removeCar(c, completed) {
    c.dead = true; res.release(c); res.unclaim(c);
    if (completed) c.state = 'COMPLETED';
  }
  /* ---------- водители ---------- */
  function mood(c, dt, intensity) {
    if (c.fumeCd > 0) c.fumeCd -= dt;
    const rate0 = c.V.animal || c.emergency || c.escort ? 0 : 8.5 * c.ch.patience * (level.patience || 1) * mod('patience') * (1 + .4 * intensity) * (c.conflictGreen ? 1.5 : 1);
    if (!c.granted && !c.free) {
      if (c.v < 5) { c.wait += dt; c.totalWait += dt; c.anger = Math.min(100, c.anger + rate0 * dt); }
      else if (c.v < c.vmax * .5) c.anger = Math.min(100, c.anger + rate0 * .35 * dt);
      else c.anger = Math.max(0, c.anger - 4 * dt);
    } else c.anger = Math.max(0, c.anger - 6 * dt);
    c.mood = c.anger < 25 ? 'calm' : c.anger < 55 ? 'impatient' : c.anger < 85 ? 'irritated' : 'critical';
    // реплики — редко, не больше одной на всю сцену за раз
    c.lineCd -= dt;
    if (!c.granted && c.anger > 50 && c.lineCd <= 0 && S.lineCd <= 0 && c.v < 3) {
      c.lineCd = 8 + rng.next() * 8; S.lineCd = LINE_GLOBAL_CD;
      const pool = { taxi: LINES.taxi, pensioner: LINES.pensioner, rich: LINES.rich, newbie: LINES.newbie, busdriver: LINES.bus }[c.char] || LINES.wait;
      emit('say', { id: c.id, text: rng.pick(pool) });
    }
    if (c.granted || c.free) return;
    const first = isFirst(c), atLine = c.path.sStop + c.creep - (c.s + c.len / 2) < 12;
    // предупреждение перед нарушением
    if (!c.fuming && c.anger >= 100 && c.fumeCd <= 0 && rate0 > 0) {
      c.fuming = true; c.fume = FUME;
      emit('say', { id: c.id, text: rng.pick(LINES.aggressive) }); emit('sfx', 'honk'); emit('buzz', 30);
    }
    if (c.fuming) {
      c.fume -= dt;
      if (c.v > 20) { c.fuming = false; c.anger = 70; }
      else if (c.fume <= 0) { c.fuming = false; rage(c, first && atLine); }
    }
    // риск при конфликте зелёных: дисциплинированные ждут, рисковые могут поехать
    if (c.conflictGreen && first && atLine && c.ch.risk > 0 && rng.next() < c.ch.risk * (.35 + c.anger / 100) * dt * .6) startRisk(c, 'risk');
  }
  function rage(c, canAct) {
    const r = c.ch.rage;
    if (canAct && r === 'run') return startRisk(c, 'run');
    if (canAct && r === 'ram') return startRam(c);
    c.fumeCd = 6; c.anger = 92;
    emit('sfx', 'honk'); emit('say', { id: c.id, text: rng.pick(LINES.wait) });
  }
  function startRisk(c, why) {
    if (c.group) breakGroup(c.group, c);
    c.violation = true; c.granted = true; c.manualGo = false;
    c.state = c.path.move === 'S' ? 'CROSSING' : 'TURNING';
    S.stats.violations++;
    emit('violation', { id: c.id, why }); emit('say', { id: c.id, text: rng.pick(LINES.run) }); emit('sfx', 'rev');
  }
  function startRam(c) {
    c.violation = true; c.free = true; c.state = 'RAM'; c.v = 20;
    S.stats.violations++;
    emit('violation', { id: c.id, why: 'ram' }); emit('say', { id: c.id, text: rng.pick(LINES.ram) }); emit('sfx', 'rev');
  }
  function stepFree(c, dt) {
    if (c.state === 'RAM') {
      const dx = geo.cop.x - c.x, dy = geo.cop.y - c.y, d = Math.hypot(dx, dy);
      c.ang = Math.atan2(dy, dx); c.v = Math.min(260, c.v + 420 * dt);
      c.x += dx / d * c.v * dt; c.y += dy / d * c.v * dt;
      if (d < 20) { c.state = 'ESCAPE'; emit('copHit', { id: c.id }); addError({ car: 'Легковушка устала ждать и выбрала тебя', truck: 'Грузовик решил, что ты — объезд' }[c.type] || 'Тебя сбил разъярённый водитель', 'ram', c); }
    } else if (c.state === 'ESCAPE') {
      c.x += Math.cos(c.ang) * 300 * dt; c.y += Math.sin(c.ang) * 300 * dt;
      if (c.x < -150 || c.x > WW + 150 || c.y < -150 || c.y > H + 150) c.dead = true;
    } else if (c.state === 'WRECK') {
      if (!c.critical && S.time - c.wreckAt > 15) { c.critical = true; S.score += SCORE.block; addError('Перекрёсток заблокирован обломками', 'block', c); }
    } else if (c.state === 'TOW') { c.towT -= dt; if (c.towT <= 0) { removeCar(c); res.release(c); } }
  }

  /* ---------- столкновения (только при нарушениях) ---------- */
  const circles = c => { const k = c.len / 3, dx = Math.cos(c.ang), dy = Math.sin(c.ang); return [-k, 0, k].map(t => ({ x: c.x + dx * t, y: c.y + dy * t })); };
  function touching(a, b) {
    const r = (a.wid + b.wid) / 2 - 3;
    for (const p of circles(a)) for (const q of circles(b)) if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < r * r) return true;
    return false;
  }
  function checkCollisions() {
    const inBoxArea = c => Math.abs(c.x - geo.C.x) < geo.bx + 60 && Math.abs(c.y - geo.C.y) < geo.by + 60;
    const movers = cars.filter(c => !c.dead && c.state !== 'WRECK' && c.state !== 'TOW' && inBoxArea(c));
    for (let i = 0; i < movers.length; i++) for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i], b = movers[j];
      if (!(a.violation || b.violation)) {
        // контроль корректности: машины по правилам не должны касаться (для тестов)
        if (a.granted && b.granted && a.path.entryKey !== b.path.entryKey && touching(a, b)) S.stats.safeOverlap = (S.stats.safeOverlap || 0) + 1;
        continue;
      }
      if (a.state === 'ESCAPE' || b.state === 'ESCAPE') continue;
      if (a.path && b.path && a.path.entryKey === b.path.entryKey && !a.free && !b.free) continue;
      if (touching(a, b)) { crash(a, b); return; }
    }
  }

  /* ---------- метрики: хаос и терпение (п. 7) ---------- */
  function metrics(dt) {
    const waiting = cars.filter(c => !c.dead && c.path && !c.free && !c.granted);
    const lanes = {};
    let waitSum = 0, waitN = 0, angerSum = 0;
    for (const c of waiting) {
      lanes[c.path.entryKey] = (lanes[c.path.entryKey] || 0) + 1;
      if (c.wait > 0) { waitSum += c.wait; waitN++; }
      if (c.v < 5) angerSum += c.anger;
    }
    const totalLanes = geo.arms.reduce((n, A) => n + (approaches.includes(A) ? geo.lanesOf(A) : 0), 0) || 1;
    const maxLane = Math.max(0, ...Object.values(lanes));
    S.stats.maxLaneQueue = Math.max(S.stats.maxLaneQueue, maxLane);
    S.queue = waiting.length; S.laneQueues = lanes;
    let blockedLanes = 0;
    for (const key of Object.keys(lanes)) {
      const firstCar = waiting.filter(c => c.path.entryKey === key).sort((a, b) => b.s - a.s)[0];
      if (firstCar && (firstCar.state === 'BLOCKED' || firstCar.state === 'BROKEN' || firstCar.wait > 12)) blockedLanes++;
    }
    const wrecks = cars.some(c => !c.dead && c.state === 'WRECK');
    const clamp = v => Math.max(0, Math.min(100, v));
    const Q = clamp(waiting.length / (totalLanes * 6) * 100);
    const Wt = clamp((waitN ? waitSum / waitN : 0) / 20 * 100);
    const B = clamp(blockedLanes / totalLanes * 100 + (wrecks ? 40 : 0));
    const D = clamp(cars.filter(c => !c.dead).length / (totalLanes * 9) * 100);
    const raw = .35 * Q + .25 * Wt + .25 * B + .15 * D;
    S.chaos += (raw - S.chaos) * Math.min(1, dt / 1.2);
    S.chaosParts = { Q, W: Wt, B, D };
    S.maxChaos = Math.max(S.maxChaos, S.chaos);
    const stopped = waiting.filter(c => c.v < 5).length;
    const pat = stopped ? 100 - angerSum / stopped : 100;
    S.patience += (pat - S.patience) * Math.min(1, dt / 1);
    S.patienceSum += S.patience * dt; S.patienceTime += dt;
    if (S.chaos >= 95) { S.chaosCrit += dt; if (S.chaosCrit >= 4) finish(false, 'Дорожный хаос: город встал'); } else S.chaosCrit = Math.max(0, S.chaosCrit - dt);
    if (level.patienceFail) { if (S.patience < 15) { S.lowPatience += dt; if (S.lowPatience > 5) finish(false, 'Терпение водителей лопнуло'); } else S.lowPatience = 0; }
    if (level.failQueue && maxLane > level.failQueue) finish(false, `Очередь больше ${level.failQueue} машин`);
  }

  /* ---------- цели ---------- */
  function progress() {
    const g = level.goal || { type: 'endless' };
    if (g.type === 'cars') return { cur: S.stats.passed, need: g.n };
    if (g.type === 'time') return { cur: S.time, need: g.t };
    if (g.type === 'special') return { cur: S.stats.byType[g.vehicle] || 0, need: g.n };
    if (g.type === 'clear') return { cur: S.queue ?? 0, need: g.queue, inverse: true, hold: S.clearHold };
    return null;
  }
  function checkGoal(dt) {
    const g = level.goal; if (!g || g.type === 'endless') return;
    let done = false;
    if (g.type === 'clear') {
      if (S.time > 5 && (S.queue ?? 99) <= g.queue) { S.clearHold += dt; done = S.clearHold >= 3; } else S.clearHold = 0;
    } else { const p = progress(); done = p.cur >= p.need; }
    if (done) finish(true, '');
    else if (level.timeLimit && S.time >= level.timeLimit) finish(false, 'Время вышло');
  }
  function extrasResult() {
    return (level.extra || []).map(e => {
      let done = false;
      if (e.type === 'noCrash') done = S.stats.crashes === 0;
      if (e.type === 'patience') done = (S.patienceSum / Math.max(1e-6, S.patienceTime)) >= e.min;
      if (e.type === 'queueMax') done = S.stats.maxLaneQueue <= e.n;
      if (e.type === 'noWhistle') done = S.whistleUses === 0;
      if (e.type === 'buses') done = (S.stats.byType.bus || 0) >= e.n;
      return { type: e.type, text: EXTRA_TEXT[e.type](e), done };
    });
  }
  function finish(win, reason) {
    if (S.over) return;
    S.over = true; S.win = win; if (reason) S.reason = reason;
    if (win && S.errors === 0) S.score += SCORE.perfect;
    const avgWait = S.stats.waitN ? S.stats.waitSum / S.stats.waitN : 0;
    const st = level.stars || [Infinity, Infinity];
    S.stars = !win ? 0 : (S.errors === 0 && S.score >= st[1] && avgWait <= (level.waitMax || 9)) ? 3 : (S.errors <= 1 && S.score >= st[0]) ? 2 : 1;
    S.result = {
      win, reason: S.reason, stars: S.stars, score: Math.max(0, Math.round(S.score)), time: S.time, errors: S.errors, passed: S.stats.passed,
      byType: { ...S.stats.byType }, avgWait, maxChaos: S.maxChaos, extras: extrasResult(),
      eventTasks: { done: S.stats.eventTasksDone, failed: S.stats.eventTasksFailed }, whistleUses: S.whistleUses,
      crashes: S.stats.crashes, turns: S.stats.turns, clean: win && S.errors === 0,
    };
    emit('finish', S.result);
  }

  /* ---------- инструменты и команды ---------- */
  function whistle(target) {
    if (S.over || S.whistleCd > 0) return false;
    S.whistleCd = 7; S.whistleUses++;
    const list = target ? [target] : cars;
    let n = 0;
    for (const c of list) {
      if (c.dead) continue;
      if (c.fuming) { c.fuming = false; c.anger = 60; c.fumeCd = 4; n++; }
      if (c.violation && !c.free && c.s + c.len / 2 < c.path.sBoxIn + 2) { c.violation = false; c.granted = false; c.state = 'WAITING'; n++; emit('say', { id: c.id, text: 'Понял, понял…' }); }
    }
    emit('whistle', { n, target: target?.id });
    return true;
  }
  function zen(A) {
    if (S.over || S.zenCd > 0 || !sig[A]) return false;
    S.zenCd = 14;
    const ids = [];
    for (const c of cars) if (!c.dead && c.path?.approach === A && !c.granted) { c.anger = 0; c.fuming = false; ids.push(c.id); }
    emit('zen', { A, ids });
    return true;
  }
  function siren() {
    if (S.over || S.siren <= 0 || S.frozen > 0) return false;
    S.siren--; S.frozen = 3;
    emit('siren', {}); return true;
  }
  function donut() {
    if (S.over || S.donut <= 0) return false;
    S.donut--;
    const ids = [];
    for (const c of cars) if (!c.dead && !c.granted && c.anger > 0) { c.anger = 0; c.fuming = false; ids.push(c.id); }
    emit('donut', { ids }); return true;
  }
  function actionsFor(c) {
    if (!c || c.dead) return [];
    if (c.state === 'WRECK' || c.state === 'BROKEN') return ['tow'];
    const a = [];
    if (!c.granted && !c.free && isFirst(c) && !c.emergency) a.push('letGo');
    if (!c.granted && !c.free && detourOptions(c).length) a.push('detour');
    if ((c.fuming || (c.violation && !c.free)) && S.whistleCd <= 0) a.push('whistle');
    return a;
  }
  function detourOptions(c) { return geo.pathsFrom(c.path.approach, c.path.lane).filter(p => p.move !== c.path.move && !closed.has(p.exitSide)); }
  function carAction(id, act) {
    const c = cars.find(x => x.id === id);
    if (!c || S.over || !actionsFor(c).includes(act)) return false;
    if (act === 'tow') {
      res.release(c); c.state = 'TOW'; c.towT = 2.2; c.free = true; c.v = 0;
      emit('tow', { id: c.id, x: c.x, y: c.y }); return true;
    }
    if (act === 'letGo') { c.manualGo = true; emit('say', { id: c.id, text: 'Спасибо, начальник!' }); return true; }
    if (act === 'detour') {
      const opts = detourOptions(c);
      const p = opts.find(x => x.move === 'R') || opts[0];
      c.path = p; c.exitBlocked = false;
      emit('say', { id: c.id, text: 'Ладно, в объезд…' }); return true;
    }
    if (act === 'whistle') return whistle(c);
    return false;
  }
  function carInfo(id) {
    const c = cars.find(x => x.id === id); if (!c) return null;
    return { id, type: c.type, name: c.V.name, char: c.ch.name, anger: Math.round(c.anger), mood: c.mood, wait: c.totalWait, move: c.path?.move, from: c.path?.approach,
      state: c.state, actions: actionsFor(c), emergency: c.emergency, broken: c.state === 'BROKEN', wreck: c.state === 'WRECK' };
  }

  /* ---------- волны и сложность (п. 8) ---------- */
  function intensityNow() {
    const minutes = S.time / 60;
    const growth = endless ? Math.max(.35, spawnCfg.growth || 0) : (spawnCfg.growth || 0);
    return (spawnCfg.rate || 14) * (1 + growth * minutes) * mod('traffic');
  }
  function wave() {
    if (level.tutorial) return 1;
    const t = S.time % 30;
    const ph = t < 7 ? 'calm' : t < 18 ? 'build' : t < 25 ? 'rush' : 'rest';
    if (ph !== S.phase) { S.phase = ph; if (ph === 'rush' && S.time > 5) emit('phase', { phase: ph }); }
    return { calm: 1.35, build: 1, rush: .65, rest: 1.9 }[ph];
  }
  function glitch(dt) {
    const M = MODIFIERS.brokenLight;
    if (!hasMod('brokenLight')) return;
    S.glitchT += dt;
    if (S.glitchT < M.glitchEvery) return;
    S.glitchT = 0;
    const greens = geo.arms.filter(A => sig[A].state === 'GO');
    const cand = geo.arms.filter(A => sig[A].state !== 'GO' && greens.some(G => !geo.compatible(G, A)));
    if (!cand.length) return;
    const A = rng.pick(cand);
    sig[A].state = 'GO';
    emit('signal', { A, state: 'GO', glitch: true }); emit('event', { id: 'glitch', A, text: '🚦 Светофор сам включил зелёный!' });
  }

  /* ---------- главный шаг ---------- */
  function step(dt) {
    if (S.over) return;
    S.time += dt;
    for (const A of geo.arms) { const s = sig[A]; if (s.state === 'PREPARE') { s.t -= dt; if (s.t <= 0) { s.state = 'STOP'; emit('signal', { A, state: 'STOP' }); } } }
    if (S.whistleCd > 0) S.whistleCd = Math.max(0, S.whistleCd - dt);
    if (S.zenCd > 0) S.zenCd = Math.max(0, S.zenCd - dt);
    S.lineCd -= dt;
    glitch(dt);
    tickEvents(dt);
    if (S.frozen > 0) { S.frozen -= dt; metrics(dt); return; }
    // появление машин
    const intensity = Math.min(1, S.time / 180);
    nextSpawn -= dt;
    if (nextSpawn <= 0) {
      const ok = spawnRandom();
      const iv = 60 / intensityNow() * wave();
      nextSpawn = ok ? iv * (.6 + rng.next() * .8) : .35;
    }
    processPending();
    // движение
    const ordered = cars.filter(c => !c.dead).sort((a, b) => b.s - a.s);
    for (const c of ordered) {
      if (c.dead) continue;
      if (c.free) stepFree(c, dt);
      else if (ON_PATH.has(c.state) || c.state === 'MOVING') stepCar(c, dt, intensity);
    }
    checkCollisions();
    // кортежи: разрыв колонны
    for (const g of groups) {
      if (g.failed || g.done) continue;
      const members = g.ids.map(id => cars.find(c => c.id === id)).filter(Boolean);
      for (let i = 1; i < members.length; i++) {
        const prev = members[i - 1], cur = members[i];
        const stoppedAtLine = !cur.granted && cur.v < 3 && cur.path.sStop - (cur.s + cur.len / 2) < 14;
        if (g.kind === 'wedding' && prev.granted && stoppedAtLine) { breakGroup(g, cur); break; }
      }
      if (g.kind === 'vip' && members.some(m => !m.granted && m.v < 2 && m.path.sStop - (m.s + m.len / 2) < 40 && m.visibleAt !== null)) breakGroup(g, members[0]);
    }
    for (let i = cars.length - 1; i >= 0; i--) if (cars[i].dead) cars.splice(i, 1);
    tickTasks(dt);
    metrics(dt);
    checkGoal(dt);
  }

  // фиксированный первый «тик», чтобы метрики и состояния были определены
  metrics(0);

  return {
    S, geo, cars, sig, level, closed, H,
    on: f => listeners.push(f),
    step, progress, setSignal, toggleSignal, permitted,
    whistle, zen, siren, donut, carAction, carInfo, actionsFor,
    hasMod, obstacles,
  };
}
