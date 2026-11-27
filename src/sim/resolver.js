/* ============ ConflictResolver ============
   Перед въездом машина резервирует ВСЕ клетки своей траектории разом (атомарно),
   поэтому взаимных блокировок «держу и жду» не бывает. Клетки освобождаются
   по мере проезда. Машины из одной полосы едут колонной и не конфликтуют друг
   с другом (порядок обеспечивает дистанция), кроме сломанных и разбитых. */
export function createResolver(geo) {
  const owners = new Map();     // клетка → Set(машин/препятствий)
  const claims = new Map();     // клетка → спецтранспорт, который ждёт проезда

  const add = (cell, o) => { let s = owners.get(cell); if (!s) owners.set(cell, s = new Set()); s.add(o); };
  const sameStream = (a, b) => a.path && b.path && a.path.entryKey === b.path.entryKey && !b.violation && b.state !== 'BROKEN' && b.state !== 'WRECK' && b.state !== 'TOW';

  // Кто мешает машине въехать (пустой список — можно)
  function blockers(car) {
    const cells = geo.pathCells(car.path, car.wid, car.len), out = new Set();
    for (const c of cells) {
      const set = owners.get(c.cell);
      if (set) for (const o of set) if (o !== car && !sameStream(car, o)) out.add(o);
      if (!car.emergency) { const cl = claims.get(c.cell); if (cl && cl !== car && !cl.dead && cl.path.entryKey !== car.path.entryKey) out.add(cl); }
    }
    return [...out];
  }
  // Есть ли место за перекрёстком (не въезжать в заблокированный перекрёсток)
  function exitFree(car, cars, closedExits) {
    if (closedExits.has(car.path.exitSide)) return false;
    const need = car.len + 10;
    for (const o of cars) {
      if (o === car || o.dead || !o.path || o.path.exitKey !== car.path.exitKey || !o.granted) continue;
      const d = o.s - o.path.sBoxOut - o.len / 2;          // задний бампер за краем перекрёстка
      if (d < need && (o.v < 15 || o.state === 'BROKEN')) return false;
    }
    return true;
  }
  function reserve(car) {
    car.cells = geo.pathCells(car.path, car.wid, car.len).map(c => ({ cell: c.cell, sLast: c.sLast }));
    for (const c of car.cells) add(c.cell, car);
  }
  function progress(car) {
    if (!car.cells || !car.cells.length) return;
    car.cells = car.cells.filter(c => {
      if (car.s > c.sLast + 3) { owners.get(c.cell)?.delete(car); return false; }
      return true;
    });
  }
  function release(car) {
    if (car.cells) for (const c of car.cells) owners.get(c.cell)?.delete(car);
    car.cells = [];
  }
  // Препятствие (разбитая машина) занимает клетки вокруг себя
  function occupy(ob, x, y, r) {
    ob.cells = [];
    geo.cellsNear(x, y, r, cell => { ob.cells.push({ cell }); add(cell, ob); });
  }
  // Спецтранспорт «бронирует» свой путь заранее: другие не начинают конфликтующих манёвров
  function claim(car) {
    if (car.claimed) return;
    car.claimed = geo.pathCells(car.path, car.wid, car.len).map(c => c.cell);
    for (const cell of car.claimed) if (!claims.has(cell)) claims.set(cell, car);
  }
  function unclaim(car) {
    if (!car.claimed) return;
    for (const cell of car.claimed) if (claims.get(cell) === car) claims.delete(cell);
    car.claimed = null;
  }
  const isBusy = cell => (owners.get(cell)?.size || 0) > 0;
  return { blockers, exitFree, reserve, progress, release, occupy, claim, unclaim, isBusy, owners };
}
