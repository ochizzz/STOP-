// Фиксированный шаг симуляции: сколько бы кадров ни рисовал телефон (30/60/120 Гц),
// правила считаются шагами одинаковой длины. Возвращает долю шага для интерполяции.
export function createClock(step, maxSteps = 5) {
  let acc = 0;
  return {
    advance(frameDt, onStep) {
      acc += Math.min(frameDt, .25);
      let n = 0;
      while (acc >= step - 1e-9 && n < maxSteps) { onStep(step); acc -= step; n++; }
      if (n === maxSteps && acc >= step) acc = 0;   // слишком медленное устройство: не копим долг
      return Math.min(1, acc / step);
    },
    reset() { acc = 0; },
  };
}
