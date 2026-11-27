// Детерминированный генератор случайных чисел (mulberry32).
// Одинаковое зерно → одинаковая смена (нужно для тестов и ежедневной смены).
export function createRng(seed = 1) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: n => Math.floor(next() * n),
    pick: arr => arr[Math.floor(next() * arr.length)],
    weighted(w) {
      let s = 0; for (const k in w) s += w[k];
      let r = next() * s;
      for (const k in w) { r -= w[k]; if (r <= 0) return k; }
      return Object.keys(w)[0];
    },
  };
}
