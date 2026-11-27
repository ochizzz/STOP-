/* ============ Звук и вибрация (WebAudio, без файлов) ============ */
export const settings = { sound: true, vibro: true, effects: true, hints: true, quality: 'high' };
let ac = null;
export function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); }
function tone(f, d, type = 'square', vol = .05, slide = 0, delay = 0) {
  if (!settings.sound || !ac) return;
  const t = ac.currentTime + delay, os = ac.createOscillator(), g = ac.createGain();
  os.type = type; os.frequency.setValueAtTime(f, t);
  if (slide) os.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  os.connect(g); g.connect(ac.destination); os.start(t); os.stop(t + d);
}
export const sfx = {
  tap() { tone(660, .05, 'triangle', .04, 200); },
  toggle() { tone(520, .06, 'triangle', .05, 120); },
  honk() { tone(310, .16, 'square', .03); tone(260, .2, 'square', .03, 0, .09); },
  chorus() { [330, 392, 494].forEach((f, i) => tone(f, .18, 'square', .025, 0, i * .07)); },
  rev() { tone(90, .35, 'sawtooth', .04, 60); },
  whistle() { tone(2100, .09, 'sine', .06, 400); tone(2300, .22, 'sine', .06, -300, .1); },
  crash() { tone(140, .4, 'sawtooth', .09, -100); tone(70, .5, 'square', .08, -30); },
  boing() { tone(220, .25, 'sine', .07, 500, .12); },
  ding() { tone(880, .1, 'triangle', .05); tone(1320, .15, 'triangle', .05, 0, .08); },
  coin() { tone(1200, .07, 'square', .03); tone(1800, .1, 'square', .03, 0, .06); },
  hurt() { tone(300, .3, 'sawtooth', .07, -220); },
  moo() { tone(140, .5, 'sawtooth', .05, -30); },
  pop() { tone(500, .08, 'triangle', .05, 300); },
  siren() { tone(700, .3, 'sine', .06, 500); tone(1200, .3, 'sine', .06, -500, .3); },
  error() { tone(200, .18, 'square', .05); tone(150, .25, 'square', .05, 0, .16); },
  win() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, .14, 'triangle', .06, 0, i * .09)); },
  star(i) { tone(880 + i * 220, .16, 'triangle', .06); },
};
export const buzz = ms => { if (settings.vibro && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };
