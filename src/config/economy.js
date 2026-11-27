/* ============ Экономика, очки, прогрессия (Economy / Difficulty Configuration) ============
   Стартовые значения для тестирования баланса (п. 13.3 ТЗ). */

// Очки за действия (п. 11)
export const SCORE = { car: 10, bus: 20, truck: 20, amb: 30, police: 30, turn: 5, perfect: 100, crash: -100, block: -30, event: 1 };

// Награды за смену. Начисляются после завершения; за каждый уровень звёзд — один раз.
export const REWARDS = {
  fail:      { cash: 10,  xp: 5 },
  star1:     { cash: 70,  xp: 40 },
  star2:     { cash: 120, xp: 75 },
  star3:     { cash: 180, xp: 120 },
  replay:    { cash: 20,  xp: 10 },     // повтор уже пройденного без новых звёзд
  challenge: { cash: 250, xp: 150 },
  daily:     { cash: 150, xp: 80, tokens: 1 },
};
export const REWARDS_EXTRA = 25;        // за каждую выполненную дополнительную задачу (cash)

// Серия ежедневных входов (п. 16)
export const STREAK = [
  { cash: 50 }, { cash: 75 }, { cash: 100 }, { cash: 150 }, { tokens: 1 }, { cash: 200 }, { tokens: 3 },
];

// Опыт и уровни игрока
export const xpNeed = lvl => 100 + (lvl - 1) * 60;

// Репутация районов (п. 14.2)
export const REP_TITLES = [
  [0, 'Стажёр'], [120, 'Местный регулировщик'], [350, 'Опытный специалист'],
  [750, 'Повелитель перекрёстка'], [1400, 'Укротитель пробок'], [2500, 'Легенда дорожного движения'],
];
export const repTier = rep => { let t = 0; REP_TITLES.forEach(([n], i) => { if (rep >= n) t = i; }); return t; };

// Ежедневные задания (п. 16): каждый день выбираются три
export const DAILY_POOL = [
  { id: 'shifts2',  icon: '🕒', text: 'Проведи две смены',          stat: 'shifts',  n: 2,  cash: 60 },
  { id: 'cars50',   icon: '🚗', text: 'Пропусти 50 автомобилей',    stat: 'cars',    n: 50, cash: 70 },
  { id: 'clean',    icon: '🛡️', text: 'Заверши смену без аварий',    stat: 'clean',   n: 1,  cash: 80 },
  { id: 'buses5',   icon: '🚌', text: 'Пропусти пять автобусов',    stat: 'bus',     n: 5,  cash: 70 },
  { id: 'event1',   icon: '⚠️', text: 'Выполни специальное поручение', stat: 'eventTasks', n: 1, cash: 80 },
  { id: 'amb2',     icon: '🚑', text: 'Пропусти две скорые',        stat: 'amb',     n: 2,  cash: 70 },
  { id: 'stars3',   icon: '⭐', text: 'Получи три звезды',           stat: 'stars',   n: 3,  cash: 90 },
];

// Достижения (п. 16)
export const ACHIEVEMENTS = [
  { id: 'first_day',   icon: '🔰', name: 'Первый рабочий день',     desc: 'Заверши первую смену',                 stat: 'shifts',     n: 1,   reward: { cash: 50 } },
  { id: 'no_incident', icon: '🛡️', name: 'Без происшествий',         desc: 'Пройди уровень без единой ошибки',     stat: 'cleanWins',  n: 1,   reward: { cash: 100 } },
  { id: 'bus_magnate', icon: '🚌', name: 'Автобусный магнат',        desc: 'Пропусти 100 автобусов',               stat: 'bus',        n: 100, reward: { tokens: 2 } },
  { id: 'ambulance',   icon: '🚑', name: 'Скорая не ждёт',           desc: 'Пропусти 20 скорых',                   stat: 'amb',        n: 20,  reward: { tokens: 1 } },
  { id: 'no_jam',      icon: '🧊', name: 'Пробка? Какая пробка?',    desc: 'Пройди уровень, не подняв хаос выше 40', stat: 'calmWins', n: 1,   reward: { cash: 150 } },
  { id: 'hundred',     icon: '💯', name: 'Сто смен подряд',          desc: 'Отработай 100 смен',                   stat: 'shifts',     n: 100, reward: { tokens: 3 } },
  { id: 'stars30',     icon: '⭐', name: 'Звёздный регулировщик',    desc: 'Собери 30 звёзд',                      stat: 'starsTotal', n: 30,  reward: { tokens: 2 } },
  { id: 'cars1000',    icon: '🚦', name: 'Тысяча машин',             desc: 'Пропусти 1000 машин',                  stat: 'cars',       n: 1000, reward: { cash: 300 } },
];
