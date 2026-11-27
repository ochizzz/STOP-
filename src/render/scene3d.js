/* ============ 3D-сцена смены (Presentation Layer) ============
   Читает состояние симуляции и рисует его. Ничего не меняет в правилах.
   Камера сверху с лёгким наклоном, не вращается (п. 19 ТЗ). */
import * as THREE from 'three';
import { MAT, vehicleGeometry, lightBar, cityGeometry, copModel, coneGeometry, box, merge } from './meshes.js';
import { HEAD } from '../sim/roadgraph.js';

export const TILT = .38;                 // наклон камеры, рад

export function createScene3D(canvas, world, theme, opts = {}) {
  const geo = world.geo, { C, bx, by, W, H, LW } = geo;
  // один рендерер на холст на всё время работы приложения
  let renderer = canvas.__renderer;
  if (!renderer) renderer = canvas.__renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.quality === 'low' ? 1.25 : 2));
  renderer.shadowMap.enabled = opts.quality !== 'low';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.ground);

  // ---------- камера ----------
  const Hv = H * Math.cos(TILT);
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, Hv / 2, -Hv / 2, 1, 5000);
  const D = 1800;
  camera.position.set(C.x, D * Math.cos(TILT), H / 2 + D * Math.sin(TILT));
  camera.lookAt(C.x, 0, H / 2);

  // ---------- свет ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9c907a, 1.15);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(C.x - 260, 520, H / 2 - 320);
  sun.target.position.set(C.x, 0, H / 2);
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -W * .9, right: W * .9, top: H * .75, bottom: -H * .75, near: 50, far: 1600 });
  sun.shadow.bias = -.0015;
  scene.add(hemi, sun, sun.target);

  // ---------- дорога и разметка ----------
  const roadMat = new THREE.MeshLambertMaterial({ color: theme.road });
  const mkPlane = (w, d, mat, x, z, y = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
  const ground = mkPlane(W + 400, H + 400, new THREE.MeshLambertMaterial({ color: theme.ground }), C.x, H / 2, -.5);
  const hasArm = a => geo.arms.includes(a);
  // вертикальная дорога
  const vTop = hasArm('N') ? -200 : C.y - by, vBot = hasArm('S') ? H + 200 : C.y + by;
  mkPlane(bx * 2, vBot - vTop, roadMat, C.x, (vTop + vBot) / 2, .05);
  const hL = hasArm('W') ? -200 : C.x - bx, hR = hasArm('E') ? W + 200 : C.x + bx;
  mkPlane(hR - hL, by * 2, roadMat, (hL + hR) / 2, C.y, .06);
  // тротуары
  const walkMat = new THREE.MeshLambertMaterial({ color: theme.walk });
  const walk = 22;
  const curb = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), 2, Math.abs(z1 - z0)), walkMat); m.position.set((x0 + x1) / 2, 1, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m); };
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xIn = C.x + sx * bx, zIn = C.y + sz * by;
    const xFar = sx < 0 ? -200 : W + 200, zFar = sz < 0 ? -200 : H + 200;
    curb(xIn + sx * walk, zIn, xFar, zIn + sz * walk);           // вдоль горизонтальной дороги
    curb(xIn, zIn + sz * walk, xIn + sx * walk, zFar);           // вдоль вертикальной
    curb(xIn, zIn, xIn + sx * walk, zIn + sz * walk);            // угол
  }
  // если стороны нет — тротуар перекрывает её
  if (!hasArm('N')) curb(C.x - bx - walk, C.y - by - walk, C.x + bx + walk, C.y - by);
  if (!hasArm('S')) curb(C.x - bx - walk, C.y + by, C.x + bx + walk, C.y + by + walk);
  if (!hasArm('W')) curb(C.x - bx - walk, C.y - by - walk, C.x - bx, C.y + by + walk);
  if (!hasArm('E')) curb(C.x + bx, C.y - by - walk, C.x + bx + walk, C.y + by + walk);
  // разметка
  const paint = [];
  const white = '#F4F4F0', yellow = '#F2C230';
  const dashV = (x, z0, z1, col, solid) => { for (let z = z0; z < z1; z += solid ? 400 : 26) paint.push(box(solid ? 2.2 : 2.4, .15, solid ? z1 - z0 : 13, col, x, .1, solid ? (z0 + z1) / 2 : z + 6.5)); };
  const dashH = (z, x0, x1, col, solid) => { for (let x = x0; x < x1; x += solid ? 400 : 26) paint.push(box(solid ? x1 - x0 : 13, .15, solid ? 2.2 : 2.4, col, solid ? (x0 + x1) / 2 : x + 6.5, .1, z)); };
  const gapV = by + 24, gapH = bx + 24;
  if (hasArm('N')) { dashV(C.x, -200, C.y - gapV, yellow, true); for (let k = 1; k < geo.nv; k++) { dashV(C.x - k * LW, -200, C.y - gapV, white); dashV(C.x + k * LW, -200, C.y - gapV, white); } }
  if (hasArm('S')) { dashV(C.x, C.y + gapV, H + 200, yellow, true); for (let k = 1; k < geo.nv; k++) { dashV(C.x - k * LW, C.y + gapV, H + 200, white); dashV(C.x + k * LW, C.y + gapV, H + 200, white); } }
  if (hasArm('W')) { dashH(C.y, -200, C.x - gapH, yellow, true); for (let k = 1; k < geo.nh; k++) { dashH(C.y - k * LW, -200, C.x - gapH, white); dashH(C.y + k * LW, -200, C.x - gapH, white); } }
  if (hasArm('E')) { dashH(C.y, C.x + gapH, W + 200, yellow, true); for (let k = 1; k < geo.nh; k++) { dashH(C.y - k * LW, C.x + gapH, W + 200, white); dashH(C.y + k * LW, C.x + gapH, W + 200, white); } }
  // пешеходные переходы
  for (const A of geo.arms) {
    const h = HEAD[A], vert = h[0] === 0, half = vert ? bx : by, ext = vert ? by : bx;
    for (let o = -half + 4; o < half - 4; o += 9) {
      const cx = vert ? C.x + o + 2.5 : C.x - h[0] * (ext + 11), cz = vert ? C.y - h[1] * (ext + 11) : C.y + o + 2.5;
      paint.push(box(vert ? 5 : 14, .15, vert ? 14 : 5, white, cx, .1, cz));
    }
  }
  const paintMesh = new THREE.Mesh(merge(paint), MAT.flat); paintMesh.receiveShadow = true; scene.add(paintMesh);
  // стоп-линии: цвет = сигнал направления
  const stopLines = {};
  for (const A of geo.arms) {
    const h = HEAD[A], vert = h[0] === 0, n = vert ? geo.nv : geo.nh, ext = vert ? by : bx;
    const r = [-h[1], h[0]];                                       // сторона въездных полос
    const len = n * LW - 4, mid = n * LW / 2;
    const mat = new THREE.MeshBasicMaterial({ color: '#E8413A' });
    const m = new THREE.Mesh(new THREE.BoxGeometry(vert ? len : 4, .4, vert ? 4 : len), mat);
    m.position.set(C.x + r[0] * mid - h[0] * (ext + 22), .25, C.y + r[1] * mid - h[1] * (ext + 22));
    scene.add(m); stopLines[A] = m;
  }
  // город
  const rand = seeded(opts.seed || 7);
  const city = new THREE.Mesh(cityGeometry(geo, theme, rand), MAT.flat);
  city.castShadow = true; city.receiveShadow = true; scene.add(city);
  // регулировщик
  const cop = copModel(opts.cosmetics);
  cop.position.set(geo.cop.x, 2, geo.cop.y);
  scene.add(cop);
  // конусы закрытых выездов
  const coneGeo = coneGeometry(), cones = new THREE.Group(); scene.add(cones);
  function setClosed(sides) {
    cones.clear();
    for (const A of sides) {
      const h = HEAD[A], vert = h[0] === 0, n = vert ? geo.nv : geo.nh, ext = vert ? by : bx;
      const l = [h[1], -h[0]];                                     // выездные полосы этой стороны (слева от въезда)
      for (let k = 0; k < n * 3; k++) {
        const o = (k + .5) * LW / 3;
        const m = new THREE.Mesh(coneGeo, MAT.flat);
        m.position.set(C.x + l[0] * o - h[0] * (ext + 30), 0, C.y + l[1] * o - h[1] * (ext + 30));
        m.castShadow = true; cones.add(m);
      }
    }
  }
  setClosed([...world.closed]);

  // ---------- машины ----------
  const meshes = new Map();       // id → { mesh, bar }
  const smoke = [];
  const smokeGeo = new THREE.IcosahedronGeometry(1, 0), smokeMat = new THREE.MeshLambertMaterial({ color: '#9AA0A8', transparent: true, opacity: .8, flatShading: true });
  const ringMat = new THREE.MeshBasicMaterial({ color: '#FFD23F', transparent: true, opacity: .9 });
  const selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 24), ringMat); selRing.rotation.x = -Math.PI / 2; selRing.visible = false; scene.add(selRing);
  function meshFor(c) {
    let m = meshes.get(c.id);
    if (m) return m;
    const mesh = new THREE.Mesh(vehicleGeometry(c.type, c.color, c.len, c.wid), MAT.flat);
    mesh.castShadow = true;
    const grp = new THREE.Group(); grp.add(mesh);
    const bar = lightBar(c.type, c.len); if (bar) grp.add(bar);
    // аварийка у сломанных
    const hz = new THREE.Group();
    for (const [x, z] of [[c.len / 2, -c.wid / 2 + 3], [c.len / 2, c.wid / 2 - 3], [-c.len / 2, -c.wid / 2 + 3], [-c.len / 2, c.wid / 2 - 3]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 3), MAT.glow('#FFA200')); l.position.set(x, 6, z); hz.add(l);
    }
    hz.visible = false; grp.add(hz);
    scene.add(grp);
    m = { grp, mesh, bar, hz, tow: 0, tilt: 0, spin: 0 };
    meshes.set(c.id, m);
    return m;
  }
  function puff(x, z, y = 10, s = 4) {
    const m = new THREE.Mesh(smokeGeo, smokeMat.clone()); m.position.set(x, y, z); m.scale.setScalar(s);
    scene.add(m); smoke.push({ m, life: 1.2, vy: 14 + Math.random() * 8 });
  }

  // ---------- кадр ----------
  let t = 0, copFly = 0, copLanded = true;
  const copBase = cop.position.clone();
  function frame(dt, alpha, selectedId) {
    t += dt;
    const seen = new Set();
    for (const c of world.cars) {
      if (c.dead) continue;
      seen.add(c.id);
      const m = meshFor(c);
      const x = c.px !== undefined ? c.px + (c.x - c.px) * alpha : c.x;
      const y = c.py !== undefined ? c.py + (c.y - c.py) * alpha : c.y;
      m.grp.position.set(x, 0, y);
      m.grp.rotation.y = -c.ang;
      // торможение — наклон вперёд, разгон — назад
      const dv = c.v - (c.prevV ?? c.v); c.prevV = c.v;
      m.tilt += ((-dv * .03) - m.tilt) * .2;
      m.mesh.rotation.z = Math.max(-.06, Math.min(.06, m.tilt));
      if (c.fuming) m.mesh.position.set(Math.sin(t * 60) * .5, 0, Math.cos(t * 47) * .5); else m.mesh.position.set(0, 0, 0);
      if (m.bar) { const f = Math.floor(t * 8) % 2; m.bar.userData.a.material.color.set(f ? '#ff3030' : '#3a0000'); m.bar.userData.b.material.color.set(f ? '#001040' : '#3070ff'); }
      m.hz.visible = (c.state === 'BROKEN' || c.state === 'WRECK') && Math.floor(t * 3) % 2 === 0;
      if (c.state === 'WRECK') {
        if (!m.wrecked) { m.wrecked = true; m.spin = (Math.random() < .5 ? -1 : 1) * 3; m.jump = 1; }
        m.jump = Math.max(0, (m.jump || 0) - dt * 2.5);
        m.grp.position.y = Math.sin(m.jump * Math.PI) * 10;
        m.mesh.rotation.x = .18 * Math.sign(m.spin);
        m.grp.rotation.y += m.spin * (m.jump || 0) * .4;
        if (Math.random() < dt * 2.5) puff(x, y, 14, 3);
      }
      if (c.state === 'BROKEN' && Math.random() < dt * 1.5) puff(x + Math.cos(c.ang) * c.len / 2, y + Math.sin(c.ang) * c.len / 2, 10, 2.5);
      if (c.state === 'TOW') { m.tow += dt; m.grp.position.y = Math.min(30, m.tow * 26); m.grp.rotation.z = Math.sin(t * 6) * .05; }
    }
    for (const [id, m] of meshes) if (!seen.has(id)) { scene.remove(m.grp); meshes.delete(id); }
    // дым
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]; s.life -= dt; s.m.position.y += s.vy * dt; s.m.scale.multiplyScalar(1 + dt * .9); s.m.material.opacity = Math.max(0, s.life / 1.2 * .8);
      if (s.life <= 0) { scene.remove(s.m); smoke.splice(i, 1); }
    }
    // сигналы
    for (const A of geo.arms) {
      const st = world.sig[A].state;
      stopLines[A].material.color.set(st === 'GO' ? '#33D17A' : st === 'PREPARE' ? (Math.floor(t * 6) % 2 ? '#FFC83D' : '#C99400') : '#E8413A');
    }
    // регулировщик: смотрит на последнее открытое направление и машет жезлом
    const greens = geo.arms.filter(A => world.sig[A].state === 'GO');
    if (greens.length) {
      const h = HEAD[greens[greens.length - 1]];
      const target = Math.atan2(-h[1], -h[0]);                   // лицом к въезду
      let d = -target - cop.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      cop.rotation.y += d * .12;
    }
    cop.userData.arm.rotation.x = -1.1 + Math.sin(t * 7) * .55;
    if (copFly > 0) {
      copFly = Math.max(0, copFly - dt);
      const p = 1 - copFly / 1.3;
      if (p < .6) { const q = p / .6; cop.position.y = copBase.y + Math.sin(q * Math.PI) * 60; cop.rotation.x = q * Math.PI * 2; }
      else { cop.position.y = copBase.y; cop.rotation.x = 0; cop.rotation.z = Math.sin(t * 40) * .3 * (1 - (p - .6) / .4); if (!copLanded) { copLanded = true; puff(copBase.x, copBase.z, 4, 5); puff(copBase.x + 6, copBase.z, 4, 4); } }
    } else { cop.rotation.z = 0; }
    // выбранная машина
    const sel = selectedId && world.cars.find(c => c.id === selectedId && !c.dead);
    selRing.visible = !!sel;
    if (sel) { selRing.position.set(sel.x, .6, sel.y); const s = Math.max(sel.len, sel.wid) * .7 + Math.sin(t * 6) * 1.5; selRing.scale.setScalar(s); }
    renderer.render(scene, camera);
  }

  // ---------- проекция для 2D-слоя и ввода ----------
  const v3 = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function project(x, y, h = 0) {
    v3.set(x, h, y).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v3.x + 1) / 2 * r.width, y: (1 - v3.y) / 2 * r.height };
  }
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane, p) ? { x: p.x, y: p.z } : null;
  }
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
  }
  function setWeather({ rain, night }) {
    const dim = (night ? .45 : 1) * (rain ? .75 : 1);
    sun.intensity = 1.6 * dim; hemi.intensity = 1.15 * (night ? .55 : 1) * (rain ? .85 : 1);
    roadMat.color.set(rain ? new THREE.Color(theme.road).multiplyScalar(.8) : theme.road);
  }
  setWeather({ rain: world.hasMod('rain'), night: world.hasMod('night') });
  resize();
  return {
    frame, project, pick, resize, setClosed, setWeather, puff,
    copHit() { copFly = 1.3; copLanded = false; },
    dispose() {
      // геометрии машин кэшируются между сменами — освобождаем только своё
      paintMesh.geometry.dispose(); city.geometry.dispose(); ground.geometry.dispose();
      renderer.renderLists.dispose();
    },
    renderer, canvas,
  };
}

function seeded(seed) { let s = seed % 2147483647 || 7; return () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646); }
