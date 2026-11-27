/* ============ Контроллер смены: цикл, ввод, HUD, 2D-слой ============
   Hybrid Control (п. 3.3): кнопки направлений на поле + жесты.
   Свайп по стороне к центру — GO, от центра — STOP; свайп по центру — открыть пару.
   Тап по машине — информация и доступные команды. */
import { createWorld, worldWidth, STEP, FUME } from '../sim/world.js';
import { createClock } from '../sim/clock.js';
import { createScene3D, TILT } from '../render/scene3d.js';
import { HEAD } from '../sim/roadgraph.js';
import { THEMES } from '../config/maps.js';
import { districtById } from '../config/levels.js';
import { GOAL_TEXT, GOAL_ICON } from '../config/texts.js';
import { itemById } from '../config/items.js';
import { audio, sfx, buzz, settings } from './sound.js';

const $ = id => document.getElementById(id);
const FACE = { calm: '😐', impatient: '😒', irritated: '😠', critical: '🤬' };
const MOVE = { S: 'прямо', R: 'направо', L: 'налево' };
const FROM = { N: 'с севера', S: 'с юга', W: 'с запада', E: 'с востока' };
const STATE_TEXT = { WAITING: 'ждёт сигнала', YIELDING: 'уступает дорогу', BLOCKED: 'путь заблокирован', CHECKING: 'проверяет перекрёсток', APPROACHING: 'подъезжает', MOVING: 'едет', SPAWNING: 'едет', CROSSING: 'проезжает', TURNING: 'поворачивает', BROKEN: 'сломалась', WRECK: 'авария', TOW: 'эвакуируется', EMERGENCY: 'спецсигнал', RAM: 'нарушает!', ESCAPE: 'скрывается' };
const ACT = { tow: ['🏗️', 'Эвакуировать'], letGo: ['👉', 'Пропустить'], detour: ['↪️', 'В объезд'], whistle: ['📣', 'Свисток'] };

let active = null;
export const Shift = {
  start(opts) { if (active) active.stop(); active = createShift(opts); return active; },
  pause() { active?.pause(); }, resume() { active?.resume(); }, stop() { active?.stop(); active = null; },
  isRunning() { return !!active && active.running(); },
};

function createShift({ level, seed, cosmetics, hints, onEnd }) {
  const stage = $('gStage'), cv3 = $('g3d'), cv2 = $('g2d'), ctx = cv2.getContext('2d');
  const district = districtById(level.district) || { theme: 'center' };
  const theme = THEMES[district.theme];
  // высота мира под пропорции экрана (камера наклонена)
  const r0 = stage.getBoundingClientRect();
  const W = worldWidth(level.map);
  const H = Math.round(Math.max(620, Math.min(1300, W * (r0.height / Math.max(1, r0.width)) / Math.cos(TILT))));
  const world = createWorld(level, { seed, H, W });
  const scene = createScene3D(cv3, world, theme, { quality: settings.quality, cosmetics, seed });
  const clock = createClock(STEP, 5);
  const geo = world.geo;
  let raf = 0, last = performance.now(), paused = false, running = true, ended = false, alpha = 1;
  const ctl = new AbortController(), L = { signal: ctl.signal };   // все слушатели снимаются при выходе
  let selected = null, zenMode = false, tutorial = hints ? 1 : 0;
  const bubbles = [], floats = [], walkers = [], toasts = [];
  let shake = 0;

  /* ---------- 2D-слой ---------- */
  function resize2d() {
    const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv2.width = r.width * dpr; cv2.height = r.height * dpr; cv2.style.width = r.width + 'px'; cv2.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene.resize();
  }
  resize2d();
  const onResize = () => resize2d();
  window.addEventListener('resize', onResize, L);

  /* ---------- кнопки направлений ---------- */
  const armsEl = $('gArms');
  armsEl.innerHTML = '';
  const armBtns = {};
  for (const A of geo.arms) {
    const b = document.createElement('button');
    b.className = 'arm'; b.dataset.a = A;
    const h = HEAD[A], deg = Math.atan2(h[1], h[0]) * 180 / Math.PI;
    b.innerHTML = `<svg viewBox="0 0 24 24" style="transform:rotate(${deg}deg)"><path d="M4 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); audio(); });
    b.addEventListener('click', e => { e.stopPropagation(); onArm(A); });
    armsEl.appendChild(b); armBtns[A] = b;
  }
  function armAnchor(A) {
    const h = HEAD[A], vert = h[0] === 0, n = vert ? geo.nv : geo.nh, ext = vert ? geo.by : geo.bx;
    const r = [-h[1], h[0]];
    return { x: geo.C.x - h[0] * (ext + 104) + r[0] * (n * geo.LW + 30), y: geo.C.y - h[1] * (ext + 104) + r[1] * (n * geo.LW + 30) };
  }
  function onArm(A) {
    if (!running || paused || world.S.over) return;
    if (zenMode) { if (world.zen(A)) { sfx.ding(); zenMode = false; } return; }
    world.toggleSignal(A); sfx.toggle(); tutorial = 0;
  }

  /* ---------- ввод на поле ---------- */
  let ptr = null;
  const carAt = p => {
    let best = null, bd = 1e9;
    for (const c of world.cars) { if (c.dead) continue; const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < Math.max(c.len, c.wid) / 2 + 12 && d < bd) { bd = d; best = c; } }
    return best;
  };
  const armAt = p => {
    const dx = p.x - geo.C.x, dy = p.y - geo.C.y;
    if (Math.abs(dx) <= geo.bx + 6 && Math.abs(dy) <= geo.by + 6) return null;
    const nx = Math.abs(dx) / geo.bx, ny = Math.abs(dy) / geo.by;
    const A = ny > nx ? (dy < 0 ? 'N' : 'S') : (dx < 0 ? 'W' : 'E');
    return geo.arms.includes(A) ? A : null;
  };
  cv2.addEventListener('pointerdown', e => {
    audio(); if (!running || paused) return;
    ptr = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
    ptr.lp = setTimeout(() => { if (ptr && !ptr.moved) { const p = scene.pick(ptr.x, ptr.y); const c = p && carAt(p); if (c) { openCard(c.id, true); ptr.done = true; } } }, 430);
  }, L);
  cv2.addEventListener('pointermove', e => {
    if (!ptr || ptr.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > 24) { ptr.moved = true; clearTimeout(ptr.lp); }
  }, L);
  cv2.addEventListener('pointerup', e => {
    if (!ptr || ptr.id !== e.pointerId) return;
    const p0 = ptr; ptr = null; clearTimeout(p0.lp);
    if (p0.done || !running || paused || world.S.over) return;
    const a = scene.pick(p0.x, p0.y), b = scene.pick(e.clientX, e.clientY);
    if (!a || !b) return;
    if (p0.moved) return swipe(a, b);
    const c = carAt(a);
    if (c) return openCard(c.id);
    closeCard();
    const A = armAt(a);
    if (A) onArm(A);
  }, L);
  function swipe(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const A = armAt(a);
    tutorial = 0;
    if (A) {
      const h = HEAD[A], toward = dx * h[0] + dy * h[1] > 0;
      world.setSignal(A, toward ? 'GO' : 'STOP'); sfx.toggle(); return;
    }
    // свайп по центру: открыть пару направлений вдоль свайпа, остальные — стоп
    const vert = Math.abs(dy) > Math.abs(dx);
    for (const X of geo.arms) world.setSignal(X, ((X === 'N' || X === 'S') === vert) ? 'GO' : 'STOP');
    sfx.whistle();
  }

  /* ---------- карточка машины ---------- */
  const card = $('gCard');
  function openCard(id, hold) {
    selected = id; renderCard(); card.classList.add('on');
    if (hold) buzz(15);
  }
  function closeCard() { selected = null; card.classList.remove('on'); }
  let cardKey = '';
  function renderCard() {
    const info = selected && world.carInfo(selected);
    if (!info) { closeCard(); return; }
    const key = [info.id, info.state, info.actions.join(), Math.round(info.anger / 5), Math.round(info.wait)].join('|');
    if (key === cardKey) return; cardKey = key;
    const moodPct = 100 - info.anger;
    card.innerHTML = `<div class="ch"><b>${info.name}</b><span>${info.char}</span><button class="cx" aria-label="закрыть">✕</button></div>
      <div class="cr"><span>${FACE[info.mood] || '😐'}</span><i class="bar"><u style="width:${moodPct}%;background:${moodPct > 60 ? '#33D17A' : moodPct > 30 ? '#FFC83D' : '#E8413A'}"></u></i><small>${Math.round(info.wait)} с</small></div>
      <div class="cs">${info.from ? FROM[info.from] + ', ' + MOVE[info.move] : ''} · ${STATE_TEXT[info.state] || ''}</div>
      <div class="ca">${info.actions.map(a => `<button data-act="${a}">${ACT[a][0]} ${ACT[a][1]}</button>`).join('') || '<small>Команды недоступны</small>'}</div>`;
    card.querySelector('.cx').onclick = closeCard;
    card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      if (world.carAction(selected, b.dataset.act)) { sfx.tap(); if (b.dataset.act !== 'detour') closeCard(); else cardKey = ''; }
    });
  }
  function placeCard() {
    if (!selected) return;
    const c = world.cars.find(x => x.id === selected && !x.dead);
    if (!c) { closeCard(); return; }
    renderCard();
    const p = scene.project(c.x, c.y, 20), r = stage.getBoundingClientRect();
    const w = card.offsetWidth, h = card.offsetHeight;
    let x = p.x - w / 2, y = p.y - h - 24;
    if (y < 120) y = p.y + 34;
    x = Math.max(8, Math.min(r.width - w - 8, x)); y = Math.max(110, Math.min(r.height - h - 8, y));
    card.style.transform = `translate(${x}px,${y}px)`;
  }

  /* ---------- инструменты ---------- */
  const tools = { whistle: $('tWhistle'), zen: $('tZen'), siren: $('tSiren'), donut: $('tDonut') };
  const toolHandlers = {
    whistle: () => { if (world.whistle()) { sfx.whistle(); buzz(20); } },
    zen: () => { if (world.S.zenCd <= 0) { zenMode = !zenMode; sfx.tap(); } },
    siren: () => { if (world.siren()) sfx.siren(); },
    donut: () => { if (world.donut()) sfx.ding(); },
  };
  for (const k in tools) tools[k].onclick = () => { audio(); if (running && !paused) toolHandlers[k](); };

  /* ---------- события симуляции ---------- */
  const carById = id => world.cars.find(c => c.id === id);
  world.on((type, d) => {
    switch (type) {
      case 'say': { const c = carById(d.id); if (c) { bubbles.push({ id: d.id, text: d.text, t: 2.4 }); if (bubbles.length > 3) bubbles.shift(); } break; }
      case 'passed': if (d.pts >= 20) floats.push({ x: d.x, y: d.y, text: '+' + d.pts, color: '#33D17A', t: 1 }); break;
      case 'crash': scene.puff(d.x, d.y, 12, 6); scene.puff(d.x + 6, d.y - 4, 16, 5); floats.push({ x: d.x, y: d.y, text: 'БДЫЩ! −100', color: '#E8413A', t: 1.4, big: true }); sfx.crash(); sfx.boing(); buzz(140); shake = .5; break;
      case 'error': toast(`❌ ${d.reason}`, 'bad'); flashErrors(); sfx.error(); break;
      case 'copHit': scene.copHit(); sfx.hurt(); buzz(200); shake = .4; break;
      case 'event': toast(d.text); sfx.ding(); break;
      case 'phase': toast('🚦 Наплыв машин'); break;
      case 'taskEnd': if (d.state === 'done') { toast(`✅ ${d.text}${d.reward ? ' +' + d.reward : ''}`, 'good'); sfx.coin(); } else toast(`✖ ${d.text} — не вышло`, 'bad'); break;
      case 'walker': walkers.push({ e: d.e, x: d.x, y: d.y, vx: Math.cos(d.ang) * 32, vy: Math.sin(d.ang) * 32, say: d.say, t: 4.5 }); break;
      case 'violation': sfx.rev(); break;
      case 'zen': for (const id of d.ids) { const c = carById(id); if (c) floats.push({ x: c.x, y: c.y, text: '✨', t: 1 }); } break;
      case 'donut': for (const id of d.ids) { const c = carById(id); if (c) floats.push({ x: c.x, y: c.y, text: '🍩', t: 1 }); } toast('🍩 Пончик мира: все успокоились'); break;
      case 'siren': toast('🚨 Сирена: все замерли'); break;
      case 'tow': sfx.pop(); break;
      case 'broken': sfx.pop(); break;
      case 'groupDone': confetti(); break;
      case 'closed': scene.setClosed(d.sides); break;
      case 'weather': scene.setWeather({ rain: d.rain, night: world.hasMod('night') }); break;
      case 'signal': if (d.glitch) sfx.error(); break;
      case 'sfx': sfx[d]?.(); break;
      case 'buzz': buzz(d); break;
      case 'finish': onFinish(d); break;
    }
  });
  function toast(text, kind = '') { toasts.push({ text, kind, t: 3 }); if (toasts.length > 2) toasts.shift(); renderToasts(); }
  function renderToasts() { $('gToasts').innerHTML = toasts.map(t => `<div class="gt ${t.kind}">${t.text}</div>`).join(''); }
  function flashErrors() { const e = $('hErrors'); e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
  function confetti() {
    const eff = itemById(cosmetics?.effect) || itemById('e-confetti');
    for (let i = 0; i < 14; i++) floats.push({ x: geo.C.x + (Math.random() - .5) * 160, y: geo.C.y + (Math.random() - .5) * 120, text: eff.burst[i % eff.burst.length], t: 1.2 + Math.random() * .6, vy: 30 + Math.random() * 40 });
  }
  function onFinish(res) {
    closeCard();
    if (res.win) { sfx.win(); confetti(); }
    setTimeout(() => {
      if (!res.win) try { res.snapshot = snapshot(); } catch (e) {}
      running = false; ended = true;
      onEnd && onEnd(res, world);
    }, res.win ? 900 : 1100);
  }
  function snapshot() {
    scene.frame(0, 1, null);
    const out = document.createElement('canvas'), w = 360, h = Math.round(360 * cv3.height / cv3.width);
    out.width = w; out.height = h;
    const o = out.getContext('2d'); o.drawImage(cv3, 0, 0, w, h); o.drawImage(cv2, 0, 0, w, h);
    return out.toDataURL('image/jpeg', .72);
  }

  /* ---------- HUD ---------- */
  let hudKey = '';
  function hud() {
    const S = world.S, p = world.progress();
    const key = [S.errors, Math.round(S.score), Math.round(S.chaos), Math.round(S.patience), p ? Math.floor(p.cur) : '', S.tasks.filter(t => t.state === 'active').map(t => t.text + Math.ceil(t.deadline ? t.deadline - (t.started ?? 0) : 0)).join(), Math.ceil(S.whistleCd), Math.ceil(S.zenCd), S.siren, S.donut, zenMode].join('|');
    for (const A of geo.arms) { const st = world.sig[A].state; armBtns[A].className = 'arm ' + st.toLowerCase() + (zenMode ? ' zen' : ''); }
    if (key === hudKey) return; hudKey = key;
    $('hErrors').innerHTML = `<b>${S.errors}</b>/${S.maxErrors}`;
    $('hScore').textContent = Math.max(0, Math.round(S.score));
    const g = level.goal;
    let txt = '', pct = 0;
    if (g.type === 'endless') { txt = `♾️ ${Math.floor(S.time)} с`; pct = 0; }
    else if (g.type === 'time') { txt = `${GOAL_ICON.time} ${Math.max(0, Math.ceil(g.t - S.time))} с`; pct = S.time / g.t; }
    else if (g.type === 'clear') { txt = `${GOAL_ICON.clear} очередь ${S.queue ?? 0} → ${g.queue}`; pct = Math.min(1, (p?.hold || 0) / 3); }
    else { txt = `${GOAL_ICON[g.type]} ${p.cur}/${p.need}`; pct = p.cur / p.need; }
    if (level.timeLimit) txt += ` · ⏳${Math.max(0, Math.ceil(level.timeLimit - S.time))}`;
    $('hGoal').querySelector('b').textContent = txt;
    $('hGoal').querySelector('u').style.width = Math.min(100, pct * 100) + '%';
    meter('hChaos', S.chaos, S.chaos > 80 ? 'bad' : S.chaos > 55 ? 'warn' : '');
    meter('hPatience', S.patience, S.patience < 25 ? 'bad' : S.patience < 50 ? 'warn' : '');
    $('hTasks').innerHTML = S.tasks.filter(t => t.state === 'active').slice(0, 2).map(t => {
      const left = t.deadline ? Math.max(0, Math.ceil(t.deadline - t.t)) : null;
      return `<div class="tk">${t.icon} ${t.text}${left !== null ? ` <b>${left}</b>` : ''}</div>`;
    }).join('');
    tool('whistle', S.whistleCd / 7, null);
    tool('zen', S.zenCd / 14, null, zenMode);
    tool('siren', 0, S.siren);
    tool('donut', 0, S.donut);
  }
  function meter(id, v, cls) { const el = $(id); el.className = 'meter ' + cls; el.querySelector('u').style.width = Math.max(0, Math.min(100, v)) + '%'; }
  function tool(k, cd, n, on) {
    const b = tools[k]; b.style.setProperty('--cd', Math.max(0, cd));
    b.classList.toggle('off', cd > 0 || n === 0); b.classList.toggle('on', !!on);
    const nn = b.querySelector('.n'); if (nn) nn.textContent = n ?? '';
  }

  /* ---------- 2D-слой: настроение, реплики, подсказки ---------- */
  function drawOverlay(dt) {
    const r = stage.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    const S = world.S;
    // ночь и дождь
    if (world.hasMod('night')) {
      const c = scene.project(geo.C.x, geo.C.y);
      const g = ctx.createRadialGradient(c.x, c.y, 90, c.x, c.y, Math.max(r.width, r.height) * .75);
      g.addColorStop(0, 'rgba(10,14,40,0)'); g.addColorStop(.5, 'rgba(10,14,40,.45)'); g.addColorStop(1, 'rgba(10,14,40,.85)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.width, r.height);
    }
    if (world.hasMod('rain')) {
      ctx.strokeStyle = 'rgba(200,215,240,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 70; i++) { const x = (i * 97 + S.time * 260) % (r.width + 40) - 20, y = (i * 173 + S.time * 620) % (r.height + 40) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); }
      ctx.stroke();
    }
    // очереди за краем экрана
    for (const A of geo.arms) {
      const off = world.cars.filter(c => !c.dead && c.path?.approach === A && !c.granted && c.visibleAt === null);
      if (!off.length) continue;
      const h = HEAD[A], an = armAnchor(A);
      let p = scene.project(an.x - h[0] * 400, an.y - h[1] * 400);
      p = { x: Math.max(36, Math.min(r.width - 36, p.x)), y: Math.max(140, Math.min(r.height - 30, p.y)) };
      pill(p.x, p.y, `+${off.length} 🚗`, '#FFFFFF', '#1F2433', 12);
    }
    // настроение и спецтранспорт
    for (const c of world.cars) {
      if (c.dead || c.free && c.state !== 'WRECK') continue;
      const p = scene.project(c.x, c.y, c.type === 'bus' || c.type === 'truck' ? 30 : 22);
      if (c.state === 'WRECK' || c.state === 'BROKEN') { badge(p.x, p.y - 10, '🔧', '#FFC83D', 1 + .12 * Math.sin(S.time * 8)); continue; }
      const task = c.emergency && S.tasks.find(t => t.state === 'active' && t.cars?.includes(c.id));
      if (task && c.visibleAt !== null) {
        const left = Math.max(0, task.deadline - (S.time - c.visibleAt));
        ring(p.x, p.y - 8, 14, left / task.deadline, left < 3 ? '#E8413A' : '#FFC83D');
        txt(Math.ceil(left), p.x, p.y - 8, 11, '#1F2433'); continue;
      }
      if (c.fuming) { const k = 1 + .15 * Math.sin(S.time * 22); ring(p.x, p.y - 8, 14 * k, c.fume / FUME, '#E8413A', '#FFE5E3'); emoji('🤬', p.x, p.y - 8, 15); continue; }
      if (c.granted || c.anger < 30 || c.V.animal) continue;
      const a = c.anger / 100;
      ring(p.x, p.y - 8, 12, a, a < .55 ? '#FFC83D' : a < .85 ? '#FF8A3D' : '#E8413A');
      emoji(FACE[c.mood], p.x, p.y - 8, 13);
    }
    // реплики
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t -= dt;
      const c = carById(b.id);
      if (b.t <= 0 || !c) { bubbles.splice(i, 1); continue; }
      const p = scene.project(c.x, c.y, 30);
      ctx.globalAlpha = Math.min(1, b.t * 3);
      speech(p.x, p.y - 30, b.text);
      ctx.globalAlpha = 1;
    }
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i]; w.t -= dt; w.x += w.vx * dt; w.y += w.vy * dt;
      if (w.t <= 0) { walkers.splice(i, 1); continue; }
      const p = scene.project(w.x, w.y, 10);
      ctx.globalAlpha = Math.min(1, w.t); emoji(w.e, p.x, p.y - Math.abs(Math.sin(S.time * 10)) * 4, 20);
      if (w.t > 2.8) speech(p.x, p.y - 26, w.say); ctx.globalAlpha = 1;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t -= dt;
      if (f.t <= 0) { floats.splice(i, 1); continue; }
      const p = scene.project(f.x, f.y, 26);
      const rise = (1.4 - f.t) * (f.vy || 26);
      ctx.globalAlpha = Math.min(1, f.t * 2);
      if (/^[+−БД]/.test(f.text)) txt(f.text, p.x, p.y - 20 - rise, f.big ? 18 : 13, f.color || '#fff', true);
      else emoji(f.text, p.x, p.y - 20 - rise, 18);
      ctx.globalAlpha = 1;
    }
    // подсказка в начале
    if (tutorial > 0 && S.time < 14) {
      const A = geo.arms.find(X => world.sig[X].state !== 'GO') || geo.arms[0];
      const an = scene.project(armAnchor(A).x, armAnchor(A).y);
      const bob = Math.sin(S.time * 6) * 6;
      pill(an.x, an.y - 58, 'Нажми стрелку или свайпни к центру', '#1F2433', '#FFFFFF', 12);
      emoji('👆', an.x + 14, an.y + 30 + bob, 30);
    }
    if (S.frozen > 0) { ctx.fillStyle = Math.floor(S.time * 8) % 2 ? 'rgba(232,65,58,.12)' : 'rgba(47,111,235,.12)'; ctx.fillRect(0, 0, r.width, r.height); }
    if (zenMode) pill(r.width / 2, r.height - 22, 'Выбери направление — успокоить водителей', '#9B51E0', '#FFFFFF', 12);
  }
  const FONT = '"Rubik",system-ui,sans-serif', EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function emoji(e, x, y, s) { ctx.fillStyle = '#000'; ctx.font = `${s}px ${EMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }
  function txt(t, x, y, s, color, outline) {
    ctx.font = `800 ${s}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (outline) { ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(31,36,51,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(t, x, y); }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
  }
  function pill(x, y, t, bg, fg, s = 12) {
    ctx.font = `700 ${s}px ${FONT}`; const w = ctx.measureText(t).width + 20, h = s + 12;
    x = Math.max(w / 2 + 6, Math.min(cv2.clientWidth - w / 2 - 6, x));
    ctx.save(); ctx.shadowColor = 'rgba(31,36,51,.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = bg; rr(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1);
  }
  function speech(x, y, t) {
    ctx.font = `700 11.5px ${FONT}`; const w = Math.min(190, ctx.measureText(t).width + 18), h = 24;
    ctx.save(); ctx.shadowColor = 'rgba(31,36,51,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#FFFFFF'; rr(x - w / 2, y - h / 2, w, h, 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 6); ctx.lineTo(x + 5, y + h / 2 - 1); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#1F2433'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1, w - 12);
  }
  function ring(x, y, rad, frac, col, bg = '#FFFFFF') {
    ctx.save(); ctx.shadowColor = 'rgba(31,36,51,.25)'; ctx.shadowBlur = 6;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, rad - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.max(.02, Math.min(1, frac)) * Math.PI * 2); ctx.stroke();
  }
  function badge(x, y, e, col, k = 1) { ctx.save(); ctx.shadowColor = 'rgba(31,36,51,.3)'; ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 14 * k, 0, Math.PI * 2); ctx.fill(); ctx.restore(); emoji(e, x, y, 15 * k); }

  /* ---------- цикл ---------- */
  function placeArms() {
    for (const A of geo.arms) {
      const an = armAnchor(A), p = scene.project(an.x, an.y, 4);
      armBtns[A].style.transform = `translate(${p.x - 24}px,${p.y - 24}px)`;
    }
  }
  function loop(now) {
    const frame = Math.min(.25, (now - last) / 1000); last = now;
    if (running && !paused) {
      alpha = clock.advance(frame, dt => { for (const c of world.cars) { c.px = c.x; c.py = c.y; } world.step(dt); });
      for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t -= frame; if (toasts[i].t <= 0) { toasts.splice(i, 1); renderToasts(); } }
      if (shake > 0 && settings.effects) { shake = Math.max(0, shake - frame); stage.style.transform = `translate(${(Math.random() - .5) * 10 * shake}px,${(Math.random() - .5) * 10 * shake}px)`; } else stage.style.transform = '';
    }
    if (!ended) {
      scene.frame(paused ? 0 : frame, paused ? 1 : alpha, selected);
      placeArms(); placeCard();
      drawOverlay(paused ? 0 : frame);
      hud();
      raf = requestAnimationFrame(loop);
    }
  }
  raf = requestAnimationFrame(loop);
  return {
    world,
    running: () => running && !paused && !world.S.over,
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    stop() { running = false; ended = true; cancelAnimationFrame(raf); ctl.abort(); closeCard(); stage.style.transform = ''; scene.dispose(); },
  };
}
