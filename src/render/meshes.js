/* ============ Low-poly модели (процедурные, без внешних ассетов) ============
   Каждая модель — одна объединённая геометрия с цветами вершин: один draw call на объект. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { itemById } from '../config/items.js';

export const MAT = {
  flat: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  glow: c => new THREE.MeshBasicMaterial({ color: c }),
};

function colorize(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}
export const box = (w, h, d, color, x = 0, y = 0, z = 0) => colorize(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);
const cyl = (rt, rb, h, seg, color, x = 0, y = 0, z = 0, rotX = 0, rotZ = 0) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rotX) g.rotateX(rotX); if (rotZ) g.rotateZ(rotZ);
  return colorize(g.translate(x, y, z), color);
};
const ico = (r, color, x, y, z, detail = 0) => colorize(new THREE.IcosahedronGeometry(r, detail).translate(x, y, z), color);
export const merge = parts => mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));

const shade = (hex, p) => { const c = new THREE.Color(hex); return p < 0 ? c.multiplyScalar(1 + p).getHex() : c.lerp(new THREE.Color('#ffffff'), p).getHex(); };

/* ---------- транспорт: длина вдоль +X, ширина вдоль Z ---------- */
const carCache = new Map();
export function vehicleGeometry(type, color, len, wid) {
  const key = `${type}|${color}|${len}`;
  if (carCache.has(key)) return carCache.get(key);
  const L = len, Wd = wid, P = [];
  const glass = '#2B3550', tyre = '#1E2128', dark = shade(color, -.35);
  const wheels = (xs, r = 4.2, w = 4) => { for (const x of xs) for (const s of [-1, 1]) P.push(cyl(r, r, w, 8, tyre, x, r, s * (Wd / 2 - 1), Math.PI / 2)); };
  if (type === 'cow') {
    P.push(box(L * .62, 12, Wd * .8, '#F4F1EA', -2, 9, 0));
    for (const [x, z] of [[-6, -5], [4, 4], [-1, 6]]) P.push(box(5, 12.2, 5, '#2A2A2A', x, 9, z));
    P.push(box(10, 9, 9, '#F4F1EA', L * .36, 14, 0));
    P.push(box(4, 4, 6, '#F2A7B8', L * .36 + 6, 14, 0));
    for (const [x, z] of [[-L * .22, -6], [-L * .22, 6], [L * .18, -6], [L * .18, 6]]) P.push(box(3.5, 9, 3.5, '#F4F1EA', x, 0, z));
    P.push(box(2, 4, 2, '#D9C9A6', L * .36 - 2, 23, -4), box(2, 4, 2, '#D9C9A6', L * .36 - 2, 23, 4));
  } else if (type === 'bus') {
    P.push(box(L, 18, Wd, color, 0, 4, 0));
    P.push(box(L - 8, 6, Wd + .4, glass, -2, 12, 0));
    P.push(box(3, 8, Wd - 4, glass, L / 2 - 1, 10, 0));
    P.push(box(L - 4, 1.5, Wd - 4, shade(color, .25), 0, 22, 0));
    wheels([-L * .32, L * .3], 5);
  } else if (type === 'truck') {
    P.push(box(L * .26, 16, Wd, color, L * .37, 4, 0));
    P.push(box(4, 6, Wd - 4, glass, L * .5 - 1, 12, 0));
    P.push(box(L * .7, 20, Wd + 1, '#E7E3DA', -L * .14, 5, 0));
    P.push(box(L * .7, 1.5, Wd + 1, '#C9C3B6', -L * .14, 25, 0));
    wheels([-L * .38, -L * .18, L * .36], 5);
  } else if (type === 'tractor') {
    P.push(box(L * .5, 9, Wd * .6, color, L * .18, 6, 0));
    P.push(box(L * .34, 16, Wd * .7, color, -L * .18, 5, 0));
    P.push(box(L * .3, 6, Wd * .66, glass, -L * .18, 15, 0));
    for (const s of [-1, 1]) P.push(cyl(8, 8, 6, 10, tyre, -L * .2, 8, s * (Wd / 2 - 2), Math.PI / 2), cyl(5, 5, 5, 8, tyre, L * .28, 5, s * (Wd / 2 - 3), Math.PI / 2));
  } else {
    // легковые
    const longCab = type === 'limo';
    P.push(box(L, 7, Wd, color, 0, 3, 0));
    P.push(box(L * .98, 1.2, Wd * .98, dark, 0, 2.2, 0));
    const cabL = longCab ? L * .62 : L * .5;
    P.push(box(cabL, 7, Wd * .84, glass, -L * .06, 10, 0));
    P.push(box(cabL * .78, 1.6, Wd * .78, color, -L * .08, 17, 0));
    P.push(box(1.6, 2.2, 5, '#FFF2B3', L / 2, 6, -Wd / 2 + 4), box(1.6, 2.2, 5, '#FFF2B3', L / 2, 6, Wd / 2 - 4));
    P.push(box(1.6, 2.2, 5, '#E8413A', -L / 2, 6, -Wd / 2 + 4), box(1.6, 2.2, 5, '#E8413A', -L / 2, 6, Wd / 2 - 4));
    wheels([-L * .3, L * .3]);
    if (type === 'taxi') { P.push(box(8, 3.5, 12, '#22252E', -2, 18.4, 0)); P.push(box(3.6, 3.7, 5, '#FFC83D', -4, 18.4, -3), box(3.6, 3.7, 5, '#FFC83D', 0, 18.4, 3)); for (let x = -L / 2 + 4; x < L / 2 - 4; x += 8) P.push(box(4, 1.2, Wd + .4, '#22252E', x, 7.2, 0)); }
    if (type === 'amb') { P.push(box(L * .96, 2.4, Wd + .3, '#E8413A', 0, 6, 0)); P.push(box(2, 1, 10, '#E8413A', -L * .08, 18.7, 0), box(10, 1, 2, '#E8413A', -L * .08, 18.7, 0)); }
    if (type === 'police') { P.push(box(L * .6, 2.4, Wd + .3, '#FFFFFF', -2, 5.5, 0)); }
    if (type === 'limo') { P.push(box(4, 7.4, Wd + .4, '#FF7AB8', 0, 3, 0)); }
    if (type === 'wcar') { P.push(box(3, 1.4, Wd * .8, '#FFFFFF', -2, 18.6, 0)); for (const z of [-6, 6]) P.push(ico(3.2, z < 0 ? '#FF7AB8' : '#FFFFFF', -L / 2 + 4, 22, z)); }
    if (type === 'clown') { P.push(ico(3.5, '#E8413A', L / 2 + 1.5, 7, 0)); for (const [x, z] of [[-10, -8], [8, 7], [-4, 9], [12, -7]]) P.push(box(4, 7.3, 4, '#FFE14D', x, 3, z)); }
    if (type === 'vip') { P.push(box(L * .96, .8, Wd + .3, '#C9A227', 0, 7.3, 0)); }
  }
  const g = merge(P);
  carCache.set(key, g);
  return g;
}

// мигалки (отдельно — они меняют цвет)
export function lightBar(type, len) {
  if (!['amb', 'police'].includes(type)) return null;
  const grp = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 5), MAT.glow('#ff3030')); a.position.set(len * .12, 19.6, -3.2);
  const b = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 5), MAT.glow('#3070ff')); b.position.set(len * .12, 19.6, 3.2);
  grp.add(a, b); grp.userData = { a, b };
  return grp;
}

/* ---------- город: здания и деревья вокруг перекрёстка ---------- */
export function cityGeometry(geo, theme, rand) {
  const { C, bx, by, W, H } = geo;
  const P = [], T = [];
  const walk = 22;                    // тротуар
  const blocks = [
    [-80, -80, C.x - bx - walk, C.y - by - walk], [C.x + bx + walk, -80, W + 80, C.y - by - walk],
    [-80, C.y + by + walk, C.x - bx - walk, H + 80], [C.x + bx + walk, C.y + by + walk, W + 80, H + 80],
  ];
  for (const [x0, y0, x1, y1] of blocks) {
    // газон / двор
    P.push(box(x1 - x0, 1.2, y1 - y0, theme.ground, (x0 + x1) / 2, .6, (y0 + y1) / 2));
    // дома рядами вдоль улиц
    const lots = [];
    const sx = x1 - x0, sy = y1 - y0;
    const nx = Math.max(1, Math.round(sx / 70)), ny = Math.max(1, Math.round(sy / 80));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const cx0 = x0 + i * sx / nx, cy0 = y0 + j * sy / ny;
      lots.push([cx0 + 6, cy0 + 6, sx / nx - 12, sy / ny - 12]);
    }
    for (const [lx, ly, lw, lh] of lots) {
      if (lw < 16 || lh < 16) continue;
      if (rand() < theme.trees) {
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const tx = lx + 8 + rand() * (lw - 16), tz = ly + 8 + rand() * (lh - 16), r = 7 + rand() * 5;
          T.push(cyl(1.6, 2, 8, 5, '#7A5A3C', tx, 4.5, tz), ico(r, rand() < .5 ? '#4FA65B' : '#3F9150', tx, 8 + r * .9, tz));
        }
        continue;
      }
      const h = 16 + rand() * 46, roof = theme.roofs[Math.floor(rand() * theme.roofs.length)];
      const bw = lw * (.75 + rand() * .2), bd = lh * (.75 + rand() * .2), bxx = lx + lw / 2, bzz = ly + lh / 2;
      P.push(box(bw, h, bd, theme.walls, bxx, 1, bzz));
      P.push(box(bw + 1.5, 3, bd + 1.5, roof, bxx, h, bzz));
      if (rand() < .55) P.push(box(Math.min(10, bw * .3), 5, Math.min(8, bd * .3), '#B8BFCC', bxx + bw * .2, h + 3, bzz - bd * .18));
      // окна полосами (южный фасад, к камере)
      for (let f = 8; f < h - 4; f += 9) P.push(box(bw * .8, 3, .6, '#8EA3BE', bxx, f, bzz + bd / 2 + .2));
    }
  }
  return merge([...P, ...T]);
}

/* ---------- регулировщик (с косметикой) ---------- */
export function copModel(eq = {}) {
  const uni = itemById(eq.uniform)?.color || '#2D6FE0';
  const bat = itemById(eq.baton) || itemById('b-classic');
  const P = [];
  const skin = '#F2C49B';
  // подиум-«стакан»
  P.push(cyl(13, 15, 6, 10, '#F2F2F2', 0, 3, 0), cyl(13.2, 13.2, 2.2, 10, '#E8413A', 0, 4, 0));
  // ноги и туловище
  P.push(box(3.6, 11, 3.6, '#2A2E3F', 0, 6, -2.4), box(3.6, 11, 3.6, '#2A2E3F', 0, 6, 2.4));
  P.push(box(7, 13, 10, uni, 0, 17, 0));
  P.push(box(7.2, 1.6, 10.2, '#1E2128', 0, 19.5, 0));
  P.push(box(3.4, 9, 3.4, uni, 0, 20, -6.6));             // левая рука
  // голова
  P.push(ico(4.8, skin, 0, 34.5, 0, 1));
  P.push(box(1.2, 1.4, 5, '#5A3A22', 4.3, 32.6, 0));        // усы
  // головной убор
  const hat = eq.hat || 'h-cap';
  if (hat === 'h-cap') P.push(cyl(5.3, 5, 3.2, 10, '#23409E', 0, 39.3, 0), box(4, .8, 7, '#14181F', 4, 37.4, 0), box(1.6, 1.6, 1.6, '#FFD23F', 4.6, 39, 0));
  if (hat === 'h-ushanka') P.push(cyl(6, 6, 5, 8, '#8D5A3B', 0, 39.5, 0), box(2.5, 6, 2, '#8D5A3B', 0, 35, -5.4), box(2.5, 6, 2, '#8D5A3B', 0, 35, 5.4));
  if (hat === 'h-cowboy') P.push(cyl(9, 9, .8, 12, '#B9733A', 0, 38.8, 0), cyl(4, 4.6, 5, 8, '#9A5E2E', 0, 41.6, 0));
  if (hat === 'h-hardhat') P.push(cyl(4, 5.8, 4, 10, '#FFD23F', 0, 39.6, 0), cyl(6.6, 6.6, .7, 10, '#F2B800', 0, 37.8, 0));
  if (hat === 'h-crown') P.push(cyl(5, 5, 3.6, 8, '#FFC400', 0, 40, 0), ico(1.2, '#E8413A', 0, 42.4, 5), ico(1.2, '#2F80ED', 0, 42.4, -5));
  if (hat === 'h-cone') P.push(cyl(.6, 5.2, 11, 8, '#FF7A1A', 0, 43.5, 0), cyl(3.6, 4.2, 2, 8, '#FFFFFF', 0, 43, 0));
  // аксессуары
  const acc = eq.accessory || 'a-none';
  if (acc === 'a-glasses') P.push(box(1, 1.6, 7, '#111111', 4.6, 35.2, 0));
  if (acc === 'a-medal') P.push(cyl(1.6, 1.6, .6, 8, '#FFC400', 3.7, 20, -2.4, 0, Math.PI / 2));
  if (acc === 'a-whistle') P.push(box(2.2, 1.2, 1.2, '#FFC400', 5, 31.5, 1.5));
  const body = new THREE.Mesh(merge(P), MAT.flat);
  body.castShadow = true;
  // рука с жезлом — отдельно, чтобы махать
  const arm = new THREE.Group();
  arm.position.set(0, 25, 6.6);
  const armMesh = new THREE.Mesh(merge([box(3.4, 3.4, 9, uni, 0, -1.7, 4.5), ico(1.9, skin, 0, 0, 9.5)]), MAT.flat);
  const baton = new THREE.Mesh(merge([cyl(1.1, 1.1, 16, 6, bat.main, 0, 0, 0), cyl(1.15, 1.15, 2.6, 6, bat.stripe, 0, 2, 0), cyl(1.15, 1.15, 2.6, 6, bat.stripe, 0, -3.5, 0)]), bat.glow ? MAT.glow(bat.main) : MAT.flat);
  baton.position.set(0, 7, 9.6);
  arm.add(armMesh, baton);
  const g = new THREE.Group();
  g.add(body, arm);
  g.userData = { arm, baton };
  return g;
}

/* ---------- дорожные конусы ---------- */
export function coneGeometry() { return merge([cyl(.5, 3.4, 9, 8, '#FF7A1A', 0, 4.5, 0), cyl(2.2, 2.6, 1.8, 8, '#FFFFFF', 0, 5, 0), box(7, 1, 7, '#FF7A1A', 0, 0, 0)]); }
