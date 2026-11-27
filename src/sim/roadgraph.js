/* ============ RoadGraph: геометрия перекрёстка ============
   Полосы, маршруты (прямо / направо / налево по кривым), конфликтные зоны.
   Правостороннее движение. Координаты мира: x вправо, y вниз. */

export const OFF = 110;      // машины появляются за краем экрана
export const CROSS = 18;     // глубина пешеходного перехода перед перекрёстком
const DS = 2;                // шаг дискретизации пути

export const HEAD = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };   // куда едут машины, въезжающие с этой стороны
export const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
const right = h => [-h[1], h[0]];
const left = h => [h[1], -h[0]];
const sideOfHeading = h => h[1] === 1 ? 'S' : h[1] === -1 ? 'N' : h[0] === 1 ? 'E' : 'W';

export function buildGeometry(mapCfg, W, H) {
  const LW = mapCfg.lane;
  const C = { x: W / 2, y: Math.round(H / 2) };
  const nv = mapCfg.v, nh = mapCfg.h;
  const bx = nv * LW, by = nh * LW;                  // полуразмеры перекрёстка
  const arms = new Set(mapCfg.arms);
  const vertical = h => h[0] === 0;
  const ext = h => vertical(h) ? by : bx;
  const nLanes = h => vertical(h) ? nv : nh;
  const lanePt = (h, k, u) => { const r = right(h), o = (k + .5) * LW; return { x: C.x + r[0] * o + h[0] * u, y: C.y + r[1] * o + h[1] * u }; };
  const uStart = h => h[1] === 1 ? -(C.y + OFF) : h[1] === -1 ? -(H - C.y + OFF) : h[0] === 1 ? -(C.x + OFF) : -(W - C.x + OFF);
  const uEnd = h => -uStart([-h[0], -h[1]]);

  // ---------- маршруты ----------
  const paths = [];
  const movesForLane = (k, n) => n === 1 ? ['S', 'R', 'L'] : k === 0 ? ['L', 'S'] : k === n - 1 ? ['S', 'R'] : ['S'];
  for (const A of ['N', 'S', 'W', 'E']) {
    if (!arms.has(A)) continue;
    const h = HEAD[A], n = nLanes(h);
    for (let k = 0; k < n; k++) for (const m of movesForLane(k, n)) {
      const h2 = m === 'S' ? h : m === 'R' ? right(h) : left(h);
      const exitSide = sideOfHeading(h2);
      if (!arms.has(exitSide)) continue;
      const n2 = nLanes(h2);
      const k2 = m === 'S' ? Math.min(k, n2 - 1) : m === 'R' ? n2 - 1 : 0;
      paths.push(makePath(A, k, m, h, h2, k2, exitSide));
    }
  }
  function makePath(A, k, m, h, h2, k2, exitSide) {
    const S0 = lanePt(h, k, uStart(h)), E0 = lanePt(h, k, -ext(h)), X0 = lanePt(h2, k2, ext(h2)), X1 = lanePt(h2, k2, uEnd(h2));
    const raw = [];
    const line = (a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L)); for (let i = 0; i < n; i++) raw.push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }); };
    line(S0, E0);
    const iIn = raw.length;
    if (m === 'S') line(E0, X0);
    else {
      const a = (X0.x - E0.x) * h[0] + (X0.y - E0.y) * h[1];               // до угла вдоль въезда
      const Q = { x: E0.x + h[0] * a, y: E0.y + h[1] * a };
      const b = Math.hypot(X0.x - Q.x, X0.y - Q.y);
      const P1 = { x: E0.x + h[0] * a * .55, y: E0.y + h[1] * a * .55 };
      const P2 = { x: X0.x - h2[0] * b * .55, y: X0.y - h2[1] * b * .55 };
      const N = 80;
      for (let i = 0; i < N; i++) {
        const t = i / N, u = 1 - t;
        raw.push({ x: u * u * u * E0.x + 3 * u * u * t * P1.x + 3 * u * t * t * P2.x + t * t * t * X0.x, y: u * u * u * E0.y + 3 * u * u * t * P1.y + 3 * u * t * t * P2.y + t * t * t * X0.y });
      }
    }
    const iOut = raw.length;
    line(X0, X1); raw.push(X1);
    // длины
    const cum = new Float64Array(raw.length);
    for (let i = 1; i < raw.length; i++) cum[i] = cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y);
    const total = cum[raw.length - 1], n = Math.floor(total / DS) + 1;
    const xs = new Float32Array(n + 1), ys = new Float32Array(n + 1), as = new Float32Array(n + 1);
    for (let i = 0, j = 0; i <= n; i++) {
      const s = Math.min(i * DS, total);
      while (j < raw.length - 2 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j] || 1, t = (s - cum[j]) / seg;
      xs[i] = raw[j].x + (raw[j + 1].x - raw[j].x) * t; ys[i] = raw[j].y + (raw[j + 1].y - raw[j].y) * t;
    }
    for (let i = 0; i <= n; i++) { const a = Math.max(0, i - 1), b = Math.min(n, i + 1); as[i] = Math.atan2(ys[b] - ys[a], xs[b] - xs[a]); }
    const sBoxIn = cum[iIn], sBoxOut = cum[iOut];
    return {
      id: `${A}${k}${m}`, approach: A, lane: k, move: m, entryKey: `${A}${k}`, exitKey: `${exitSide}${k2}`, exitSide,
      h, h2, xs, ys, as, n, total, sBoxIn, sBoxOut, sStop: sBoxIn - CROSS - 5, cells: {},
    };
  }

  // ---------- конфликтные зоны: сетка по перекрёстку ----------
  const CS = LW / 2, gx0 = C.x - bx - CS, gy0 = C.y - by - CS;
  const nx = Math.ceil((2 * bx + 2 * CS) / CS), ny = Math.ceil((2 * by + 2 * CS) / CS);
  function cellsNear(x, y, r, out) {
    const i0 = Math.max(0, Math.floor((x - r - gx0) / CS)), i1 = Math.min(nx - 1, Math.floor((x + r - gx0) / CS));
    const j0 = Math.max(0, Math.floor((y - r - gy0) / CS)), j1 = Math.min(ny - 1, Math.floor((y + r - gy0) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = Math.max(gx0 + i * CS, Math.min(x, gx0 + (i + 1) * CS)), cy = Math.max(gy0 + j * CS, Math.min(y, gy0 + (j + 1) * CS));
      if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) out(j * nx + i);
    }
  }
  // клетки, которые займёт машина ширины wid на этом пути; sLast — где их можно освободить
  // корпус машины — три круга вдоль длины: на поворотах углы уходят с центральной линии
  function pathCells(path, wid, len = 46) {
    const key = Math.round(wid) + ':' + Math.round(len);
    if (path.cells[key]) return path.cells[key];
    const map = new Map(), r = wid / 2 + 1.5, k = len / 3;
    for (let s = path.sBoxIn - len / 2; s <= path.sBoxOut + len / 2; s += DS) {
      const p = pos(path, s), dx = Math.cos(p.ang) * k, dy = Math.sin(p.ang) * k;
      for (const f of [-1, 0, 1]) cellsNear(p.x + dx * f, p.y + dy * f, r, c => map.set(c, s));
    }
    return (path.cells[key] = [...map].map(([cell, sLast]) => ({ cell, sLast })));
  }

  // ---------- совместимость направлений ----------
  // Совместимы встречные направления, если их прямые маршруты не пересекаются.
  // Левый поворот против встречного прямого — разрешённый «уступи дорогу».
  const compat = {};
  for (const A of arms) for (const B of arms) {
    if (A === B) { compat[A + B] = true; continue; }
    let ok = OPP[A] === B;
    if (ok) {
      const a = paths.filter(p => p.approach === A && p.move === 'S').flatMap(p => pathCells(p, 28).map(c => c.cell));
      const b = new Set(paths.filter(p => p.approach === B && p.move === 'S').flatMap(p => pathCells(p, 28).map(c => c.cell)));
      ok = !a.some(c => b.has(c));
    }
    compat[A + B] = ok;
  }

  return {
    W, H, C, LW, bx, by, nv, nh, arms: [...arms], paths, CS, gx0, gy0, nx, ny,
    lanePt, pathCells, cellsNear, compatible: (A, B) => !!compat[A + B],
    pathsFrom: (A, k) => paths.filter(p => p.approach === A && p.lane === k),
    lanesOf: A => nLanes(HEAD[A]),
    cop: { x: C.x - bx - 34, y: C.y + by + 34 },
  };
}

export function pos(path, s) {
  const f = Math.max(0, Math.min(path.n, s / DS)), i = Math.min(path.n - 1, Math.floor(f)), t = f - i;
  return {
    x: path.xs[i] + (path.xs[i + 1] - path.xs[i]) * t,
    y: path.ys[i] + (path.ys[i + 1] - path.ys[i]) * t,
    ang: lerpAng(path.as[i], path.as[i + 1], t),
  };
}
function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
