/* ============ Город → районы → уровни (District / Level Configuration) ============
   Каждый уровень ссылается на карту (maps.js) и задаёт свой сценарий:
   трафик, основную и дополнительные задачи, события, модификаторы, условия поражения.
   Баланс правится здесь, без изменения кода. */

export const DISTRICTS = [
  { id: 'oldtown',    name: 'Старый город',   feature: 'Узкие дороги',         icon: '🏛️', theme: 'oldtown',    unlock: {} },
  { id: 'sleep',      name: 'Спальный район', feature: 'Автобусы и очереди',   icon: '🏘️', theme: 'sleep',      unlock: { stars: 3, levels: ['old-2'] } },
  { id: 'center',     name: 'Центр',          feature: 'Большой трафик',       icon: '🏙️', theme: 'center',     unlock: { stars: 8, playerLevel: 3 } },
  { id: 'market',     name: 'Рынок',          feature: 'Такси и нервы',        icon: '🛒', theme: 'market',     unlock: { stars: 13 } },
  { id: 'industrial', name: 'Промзона',       feature: 'Грузовой транспорт',   icon: '🏭', theme: 'industrial', unlock: { stars: 18, reputation: { center: 1 } } },
  { id: 'highway',    name: 'Автомагистраль', feature: 'Высокая скорость',     icon: '🛣️', theme: 'highway',    unlock: { stars: 24, playerLevel: 6 } },
];

const R = (S, R_, L) => ({ S, R: R_, L });
// spawn.rate — машин в минуту на старте, growth — прирост за минуту (доля), mix — состав потока
export const LEVELS = [
  // ---------- Старый город ----------
  { id: 'old-1', district: 'oldtown', name: 'Первая смена', map: 'cross', tutorial: true,
    boss: 'Сегодня только две стороны и только прямо. Пусти одних, потом других — и не одновременно.',
    spawn: { approaches: ['N', 'W'], rate: 9, growth: 0, mix: { car: 1 }, routes: R(1, 0, 0) },
    goal: { type: 'cars', n: 10 }, maxErrors: 5, events: [], stars: [100, 140] },
  { id: 'old-2', district: 'oldtown', name: 'Четыре стороны', map: 'cross',
    boss: 'Теперь все четыре стороны и повороты. Север с югом можно пускать вместе.',
    spawn: { rate: 14, growth: .15, mix: { car: 1 }, routes: R(.6, .22, .18) },
    goal: { type: 'cars', n: 20 }, extra: [{ type: 'noCrash' }], events: ['breakdown'], stars: [240, 320] },
  { id: 'old-3', district: 'oldtown', name: 'Узкие улочки', map: 'narrow',
    boss: 'Улицы узкие, повороты тесные. Пенсионеры не торопятся, а таксисты — наоборот.',
    spawn: { rate: 15, growth: .2, mix: { car: .75, taxi: .25 }, routes: R(.55, .25, .2) },
    goal: { type: 'time', t: 90 }, extra: [{ type: 'patience', min: 50 }], events: ['breakdown', 'wedding', 'angry'], stars: [300, 420] },

  // ---------- Спальный район ----------
  { id: 'sleep-1', district: 'sleep', name: 'Утро понедельника', map: 'avenue',
    boss: 'Автобусы должны проходить без задержек.',
    spawn: { rate: 16, growth: .2, mix: { car: .72, bus: .28 }, routes: R(.62, .2, .18) },
    goal: { type: 'special', vehicle: 'bus', n: 4 }, extra: [{ type: 'queueMax', n: 8 }], events: ['jam'], stars: [260, 360] },
  { id: 'sleep-2', district: 'sleep', name: 'Школьный автобус', map: 'avenue',
    boss: 'Школьники опаздывают. Скорые тоже не ждут.',
    spawn: { rate: 17, growth: .2, mix: { car: .65, bus: .35 }, routes: R(.6, .22, .18) },
    goal: { type: 'cars', n: 30 }, extra: [{ type: 'buses', n: 6 }], events: ['ambulance', 'breakdown'], stars: [380, 500] },
  { id: 'sleep-3', district: 'sleep', name: 'Свадьба во дворах', map: 'cross',
    boss: 'Сегодня не должно быть ни одной аварии. И ни одного разорванного кортежа.',
    spawn: { rate: 16, growth: .2, mix: { car: .85, taxi: .15 }, routes: R(.6, .2, .2) },
    goal: { type: 'time', t: 120 }, extra: [{ type: 'noCrash' }], events: ['wedding', 'wedding', 'angry', 'cow'], stars: [420, 560] },

  // ---------- Центр ----------
  { id: 'center-1', district: 'center', name: 'Час пик', map: 'big',
    boss: 'Центр стоит. Разгони его — свисток сегодня не трогай.',
    spawn: { rate: 22, growth: .25, mix: { car: .75, taxi: .15, bus: .1 }, routes: R(.6, .22, .18) },
    goal: { type: 'cars', n: 40 }, extra: [{ type: 'noWhistle' }], events: ['jam', 'ambulance'], stars: [520, 680] },
  { id: 'center-2', district: 'center', name: 'Делегация', map: 'big',
    boss: 'Ожидается делегация. Кортеж не должен останавливаться ни на секунду.',
    spawn: { rate: 20, growth: .2, mix: { car: .8, taxi: .2 }, routes: R(.6, .22, .18) },
    goal: { type: 'time', t: 120 }, extra: [{ type: 'noCrash' }], events: ['vip', 'vip', 'ambulance', 'breakdown'], stars: [520, 700] },
  { id: 'center-3', district: 'center', name: 'Разгрузить центр', map: 'big',
    boss: 'Перекрёсток забит с утра. Разгрузи его, пока мэр не проснулся.',
    spawn: { rate: 16, growth: .1, mix: { car: .8, bus: .1, taxi: .1 }, routes: R(.6, .22, .18), preload: 5 },
    goal: { type: 'clear', queue: 6 }, timeLimit: 100, events: ['ambulance'], stars: [300, 420] },

  // ---------- Рынок ----------
  { id: 'market-1', district: 'market', name: 'Базарный день', map: 'cross',
    boss: 'Таксисты сегодня нервные. Следи за ними.',
    spawn: { rate: 18, growth: .25, mix: { car: .55, taxi: .45 }, routes: R(.55, .25, .2) },
    goal: { type: 'cars', n: 30 }, extra: [{ type: 'noCrash' }], events: ['angry', 'breakdown', 'clown'], stars: [380, 500] },
  { id: 'market-2', district: 'market', name: 'Жалобная книга', map: 'cross',
    boss: 'На этот перекрёсток поступило слишком много жалоб. Терпение водителей — на первом месте.',
    spawn: { rate: 17, growth: .2, mix: { car: .6, taxi: .4 }, routes: R(.55, .25, .2) },
    goal: { type: 'time', t: 120 }, patienceFail: true, extra: [{ type: 'patience', min: 60 }], events: ['angry', 'jam'], stars: [420, 560] },
  { id: 'market-3', district: 'market', name: 'Неисправный светофор', map: 'cross', modifiers: ['brokenLight'],
    boss: 'Автоматика сошла с ума и сама включает зелёный. Исправляй за ней.',
    spawn: { rate: 16, growth: .2, mix: { car: .7, taxi: .3 }, routes: R(.6, .22, .18) },
    goal: { type: 'time', t: 100 }, events: ['breakdown'], stars: [360, 480] },

  // ---------- Промзона ----------
  { id: 'ind-1', district: 'industrial', name: 'Смена на заводе', map: 'teeWide',
    boss: 'Грузовики поворачивают широко. Не зажимай их.',
    spawn: { rate: 15, growth: .2, mix: { car: .6, truck: .4 }, routes: R(.5, .3, .2) },
    goal: { type: 'special', vehicle: 'truck', n: 6 }, events: ['breakdown'], stars: [300, 420] },
  { id: 'ind-2', district: 'industrial', name: 'Ремонт дороги', map: 'teeWide', modifiers: ['repair'],
    boss: 'Один выезд закрыт на ремонт. Кому туда — отправляй в объезд.',
    spawn: { rate: 15, growth: .2, mix: { car: .65, truck: .35 }, routes: R(.5, .3, .2) },
    goal: { type: 'cars', n: 30 }, events: ['breakdown', 'angry'], stars: [380, 500] },
  { id: 'ind-3', district: 'industrial', name: 'Ночная отгрузка', map: 'tee', modifiers: ['night'],
    boss: 'Ночью видно только перекрёсток. Грузовики всё равно едут.',
    spawn: { rate: 15, growth: .2, mix: { car: .55, truck: .45 }, routes: R(.5, .3, .2) },
    goal: { type: 'time', t: 120 }, events: ['breakdown', 'ambulance'], stars: [400, 540] },

  // ---------- Автомагистраль ----------
  { id: 'hw-1', district: 'highway', name: 'Съезд с трассы', map: 'big', modifiers: ['fast'],
    boss: 'Машины с трассы быстрые и тормозят долго. Переключай заранее.',
    spawn: { rate: 22, growth: .2, mix: { car: .7, truck: .15, taxi: .15 }, routes: R(.6, .22, .18) },
    goal: { type: 'cars', n: 40 }, events: ['ambulance', 'jam'], stars: [520, 680] },
  { id: 'hw-2', district: 'highway', name: 'Дождь на трассе', map: 'big', modifiers: ['rain', 'fast'],
    boss: 'Дождь. Тормозной путь длиннее — не рискуй.',
    spawn: { rate: 20, growth: .2, mix: { car: .75, truck: .15, bus: .1 }, routes: R(.6, .22, .18) },
    goal: { type: 'time', t: 120 }, extra: [{ type: 'noCrash' }], events: ['breakdown', 'ambulance'], stars: [460, 620] },
  { id: 'hw-3', district: 'highway', name: 'Критическая смена', map: 'big', modifiers: ['fast'],
    boss: 'Всё и сразу. Если справишься — ты легенда.',
    spawn: { rate: 26, growth: .25, mix: { car: .6, taxi: .15, truck: .15, bus: .1 }, routes: R(.58, .22, .2) },
    goal: { type: 'cars', n: 60 }, timeLimit: 200, events: ['ambulance', 'vip', 'breakdown', 'jam', 'angry'], stars: [760, 980] },
];

/* Испытания (п. 10.3): короткие сценарии с особыми условиями */
export const CHALLENGES = [
  { id: 'ch-50', name: '50 машин без аварий', icon: '🛡️', map: 'cross', district: 'oldtown', hard: false,
    spawn: { rate: 20, growth: .2, mix: { car: .8, taxi: .2 }, routes: R(.6, .22, .18) }, goal: { type: 'cars', n: 50 }, failOnCrash: true, events: ['breakdown'] },
  { id: 'ch-30in90', name: '30 машин за 90 секунд', icon: '⏱️', map: 'avenue', district: 'sleep', hard: false,
    spawn: { rate: 26, growth: .1, mix: { car: .85, bus: .15 }, routes: R(.7, .18, .12) }, goal: { type: 'cars', n: 30 }, timeLimit: 90, events: [] },
  { id: 'ch-amb', name: 'Три скорые', icon: '🚑', map: 'big', district: 'center', hard: false,
    spawn: { rate: 18, growth: .15, mix: { car: 1 }, routes: R(.6, .22, .18) }, goal: { type: 'special', vehicle: 'amb', n: 3 }, events: ['ambulance', 'ambulance', 'ambulance'], eventEvery: [10, 16] },
  { id: 'ch-q10', name: 'Очередь не больше 10', icon: '📏', map: 'cross', district: 'market', hard: true,
    spawn: { rate: 22, growth: .3, mix: { car: .7, taxi: .3 }, routes: R(.6, .22, .18) }, goal: { type: 'time', t: 90 }, failQueue: 10, events: ['jam'] },
  { id: 'ch-light', name: 'Неисправный светофор', icon: '🚦', map: 'big', district: 'center', hard: true, modifiers: ['brokenLight'],
    spawn: { rate: 20, growth: .2, mix: { car: .8, bus: .1, taxi: .1 }, routes: R(.6, .22, .18) }, goal: { type: 'time', t: 90 }, events: ['breakdown'] },
  { id: 'ch-clear', name: 'Разгрузка за минуту', icon: '🧹', map: 'big', district: 'center', hard: true,
    spawn: { rate: 12, growth: 0, mix: { car: .85, bus: .15 }, routes: R(.65, .2, .15), preload: 7 }, goal: { type: 'clear', queue: 4 }, timeLimit: 60, events: [] },
];

export const levelById = id => LEVELS.find(l => l.id === id) || CHALLENGES.find(c => c.id === id) || null;
export const districtById = id => DISTRICTS.find(d => d.id === id);
