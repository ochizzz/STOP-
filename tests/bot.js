// Простой регулировщик для проверки баланса: видит только то, что видит игрок
export function createBot(w) {
  const arms = w.geo.arms, groups = [];
  for (const A of arms) if (!groups.some(g => g.includes(A))) groups.push(arms.filter(B => B === A || w.geo.compatible(A, B)));
  let cur = 0, held = 0, tick = 0;
  const pressure = g => {
    let p = 0;
    for (const c of w.cars) if (!c.dead && c.path && !c.free && !c.granted && g.includes(c.path.approach)) p += 1 + c.wait * .25 + c.anger * .02 + (c.emergency ? 60 : 0) + (c.group ? 8 : 0);
    return p;
  };
  return dt => {
    held += dt; tick += dt;
    if (tick < .25) return; tick = 0;
    for (const c of w.cars) {
      if (c.state === 'WRECK' || c.state === 'BROKEN') w.carAction(c.id, 'tow');
      else if (c.state === 'BLOCKED' && c.exitBlocked) w.carAction(c.id, 'detour');
      if (c.fuming && w.S.whistleCd <= 0) w.whistle();
    }
    const ps = groups.map(pressure);
    let best = ps.indexOf(Math.max(...ps));
    if (best !== cur && (held > 5 && ps[best] > ps[cur] * 1.5 || held > 11 && ps[best] > 0 || ps[cur] === 0 && ps[best] > 0 && held > 1.5)) { cur = best; held = 0; }
    groups.forEach((g, i) => g.forEach(A => w.setSignal(A, i === cur ? 'GO' : 'STOP')));
  };
}
