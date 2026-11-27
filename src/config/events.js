/* ============ Дорожные события (Event Configuration) ============
   weight — вероятность выбора, minTime — не раньше N сек от начала, cooldown — пауза
   до повторения, duration — длительность (для модификаторов), deadline — время на задачу,
   reward — бонус очков за выполненную задачу события, excl — с чем не может идти одновременно. */
export const EVENTS = {
  ambulance: { id: 'AmbulanceIncoming', name: 'Скорая помощь',     icon: '🚑', weight: 3, minTime: 18, cooldown: 30, deadline: 10, reward: 60,  task: 'Срочно пропусти скорую' },
  breakdown: { id: 'VehicleBreakdown',  name: 'Поломка',            icon: '🔧', weight: 3, minTime: 22, cooldown: 35, deadline: 25, reward: 40,  task: 'Убери сломанную машину', excl: ['breakdown'] },
  wedding:   { id: 'WeddingConvoy',     name: 'Свадебный кортеж',   icon: '💒', weight: 2, minTime: 12, cooldown: 45, reward: 150, task: 'Проведи кортеж целым', excl: ['vip', 'wedding'] },
  vip:       { id: 'VIPConvoy',         name: 'VIP-кортеж',         icon: '🎩', weight: 2, minTime: 18, cooldown: 55, reward: 200, task: 'Кортеж не должен останавливаться', excl: ['vip', 'wedding'] },
  rain:      { id: 'RainStarted',       name: 'Дождь',              icon: '🌧️', weight: 1, minTime: 25, cooldown: 80, duration: 35 },
  repair:    { id: 'RoadRepair',        name: 'Ремонт дороги',      icon: '🚧', weight: 1, minTime: 25, cooldown: 80, duration: 40, reward: 30, task: 'Направь машины в объезд', excl: ['repair'] },
  angry:     { id: 'AngryDriver',       name: 'Агрессивный водитель', icon: '😤', weight: 2, minTime: 8, cooldown: 22 },
  jam:       { id: 'TrafficJam',        name: 'Наплыв машин',       icon: '🚗', weight: 2, minTime: 20, cooldown: 40 },
  cow:       { id: 'CowCrossing',       name: 'Корова на дороге',   icon: '🐄', weight: 1, minTime: 15, cooldown: 60 },
  clown:     { id: 'ClownCar',          name: 'Клоун-кар',          icon: '🤡', weight: 1, minTime: 15, cooldown: 50 },
};

// Модификаторы карт (п. 8.3): меняют реальные параметры симуляции
export const MODIFIERS = {
  rain:       { name: 'Дождь',                icon: '🌧️', brake: .6,  vmax: .88, accel: .85 },
  ice:        { name: 'Гололёд',              icon: '🧊', brake: .45, vmax: .8,  accel: .6 },
  night:      { name: 'Ночь',                 icon: '🌙', patience: 1.1 },
  fast:       { name: 'Скоростная трасса',    icon: '💨', vmax: 1.25, brake: .9 },
  repair:     { name: 'Дорожный ремонт',      icon: '🚧', closeExit: true },
  holiday:    { name: 'Праздник',             icon: '🎉', traffic: 1.25, events: ['wedding', 'vip'] },
  brokenLight:{ name: 'Неисправный светофор', icon: '🚦', glitchEvery: 11 },
  heavy:      { name: 'Повышенный трафик',    icon: '📈', traffic: 1.4 },
};
