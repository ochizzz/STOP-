/* ============ СТОП! — данные игры ============ */
'use strict';

/* Темы районов: яркие, «уличные», но без лишнего шума */
const THEMES = {
  taxi:    { name:'Деловой центр',      icon:'🚕', road:'#454C66', line:'#FFD60A', walk:'#F4EEDC', ground:'#FFC93C', roofs:['#5C6BC0','#26A69A','#EF5350','#42A5F5','#FFFFFF'], trees:0.15, deco:['🏪','🚏'] },
  wedding: { name:'Свадебный квартал', icon:'💒', road:'#4A4F6E', line:'#FFFFFF', walk:'#FFF0F7', ground:'#FF8FC8', roofs:['#FFFFFF','#FFD1E8','#B39DDB','#FFE082','#80DEEA'], trees:0.25, deco:['💒','🎈'] },
  goose:   { name:'Гусиный парк',       icon:'🪿', road:'#475069', line:'#FFD60A', walk:'#EAF4E0', ground:'#6FD35B', roofs:['#FF8A65','#FFD54F','#4FC3F7','#F06292'],           trees:0.6,  deco:['🌻','🪿'] },
  cow:     { name:'Колхоз «Заря»',      icon:'🐄', road:'#8A6A4C', line:'#FFE9A8', walk:'#F3E5C0', ground:'#8BD45A', roofs:['#D84315','#8D6E63','#FBC02D','#E53935'],           trees:0.4,  deco:['🌾','🐓'] },
};

/* Транспорт */
const TYPES = {
  car:    { len:44, wid:27, vmax:108, rate:9,  pts:10,  colors:['#2D7DFF','#3DDC5C','#FF3B30','#FF9F1C','#A259FF','#18C8C8','#FF5FAE','#F5F7FF'] },
  taxi:   { len:46, wid:27, vmax:138, rate:20, pts:20,  color:'#FFD60A' },
  amb:    { len:54, wid:29, vmax:160, rate:0,  pts:100, color:'#FFFFFF' },
  limo:   { len:66, wid:28, vmax:110, rate:15, pts:25,  icon:'👰', color:'#FFFFFF' },
  wcar:   { len:44, wid:27, vmax:110, rate:15, pts:20,  icon:'🤵', color:'#FFC4DE' },
  cow:    { len:36, wid:28, vmax:30,  rate:0,  pts:50,  icon:'🐄', animal:30, stare:true },
  goose:  { len:20, wid:20, vmax:45,  rate:0,  pts:30,  icon:'🪿', animal:22 },
  tractor:{ len:46, wid:30, vmax:48,  rate:4,  pts:30,  color:'#3DDC5C' },
  clown:  { len:42, wid:29, vmax:115, rate:10, pts:40,  icon:'🤡', color:'#FF5FAE', stalls:true },
  bus:    { len:78, wid:32, vmax:80,  rate:9,  pts:40,  color:'#FFD60A' },
};

/* Базовые веса появления по районам */
const DISTRICT_W = {
  taxi:    { car:30, taxi:45, amb:6, cortege:4, clown:6, bus:8 },
  wedding: { car:38, taxi:12, amb:5, cortege:28, clown:6, bus:6, goose:3 },
  goose:   { car:50, taxi:10, amb:5, cortege:3, goose:25, clown:4, bus:3 },
  cow:     { car:34, taxi:8, amb:5, cortege:3, cow:20, tractor:18, clown:6, bus:3 },
};

/* ---------- Город ---------- */
const CITY = {
  w: 400, h: 1000,
  cols: [114, 200, 286],
  rows: [110, 260, 410, 600, 750, 900],
  river: [478, 532],               // полоса реки
  road: 26,
  vStreets: ['ул. Ленина', 'пр. Мира', 'ул. Пушкина'],
  hStreets: ['Деловая', 'Таксистов', 'Свадебная', 'Гусиная', 'Колхозная', 'Тракторная'],
  rowTheme: ['taxi', 'taxi', 'wedding', 'goose', 'cow', 'cow'],
};

/* ---------- Шаблоны заданий ---------- */
const MISSIONS = [
  { id:'wedding',  icon:'💒', title:'Свадебный переполох', desc:'Три свадьбы в один час. Не разорви ни один кортеж.', theme:'wedding', w:{ cortege:34 }, goal:{ type:'cortege', n:2 }, diff:2 },
  { id:'geese',    icon:'🪿', title:'Гусиная забастовка',  desc:'Гуси перекрыли движение и требуют хлеба. Продержись.', theme:'goose', w:{ goose:40 }, goal:{ type:'survive', t:45 }, diff:1 },
  { id:'amb',      icon:'🚑', title:'День скорой',         desc:'Скорые едут одна за другой. Не задержи ни одну.', w:{ amb:26 }, goal:{ type:'amb', n:4 }, diff:2 },
  { id:'taxi',     icon:'🚕', title:'Война таксистов',     desc:'Таксисты делят перекрёсток. Им всё равно, кто ты.', theme:'taxi', w:{ taxi:60 }, goal:{ type:'score', n:260 }, diff:2 },
  { id:'cows',     icon:'🐄', title:'Побег из колхоза',    desc:'Стадо идёт в город за лучшей жизнью. Пропусти коров.', theme:'cow', w:{ cow:38 }, goal:{ type:'cow', n:6 }, diff:1 },
  { id:'clean',    icon:'🧼', title:'Чистая смена',        desc:'Начальник смотрит из кустов. Ни одного ДТП.', goal:{ type:'cars', n:25, noCrash:true }, diff:3 },
  { id:'circus',   icon:'🤡', title:'Цирк приехал',        desc:'Клоун-кары глохнут где попало. Держись.', w:{ clown:32 }, goal:{ type:'survive', t:60 }, diff:2 },
  { id:'rush',     icon:'⏰', title:'Час пик',             desc:'Весь город едет с работы одновременно.', spawnMul:0.72, goal:{ type:'cars', n:40 }, diff:3 },
  { id:'night',    icon:'🌙', title:'Ночная смена',        desc:'Фонари украли. Видно только перекрёсток.', night:true, goal:{ type:'survive', t:40 }, diff:2 },
  { id:'bus',      icon:'🚌', title:'Парад автобусов',     desc:'Все автобусы города решили проехать здесь.', w:{ bus:34 }, goal:{ type:'survive', t:50 }, diff:1 },
  { id:'mayor',    icon:'🎩', title:'Проверка от мэра',    desc:'Мэр считает очки. Покажи класс.', goal:{ type:'score', n:400 }, diff:3 },
  { id:'tractor',  icon:'🚜', title:'Тракторный марафон',  desc:'Тракторы едут на выставку. Очень медленно.', theme:'cow', w:{ tractor:40 }, goal:{ type:'cars', n:20 }, diff:1 },
];
/* Первая смена — обучение, выдаётся один раз */
const INTRO_MISSION = { id:'intro', icon:'🔰', title:'Первая смена', desc:'Свайпни вдоль дороги — по ней поедут машины. Две дороги сразу не пускай.', goal:{ type:'survive', t:30 }, diff:1, spawnMul:1.35, w:{ amb:0, cortege:0, clown:0 } };

/* Как называть участников в причинах провала */
const NAME = { car:'легковушка', taxi:'такси', amb:'скорая', limo:'лимузин', wcar:'свадебная машина', cow:'корова', goose:'гусь', tractor:'трактор', clown:'клоун-кар', bus:'автобус' };
const RAM_REASON = {
  car:   'Легковушка устала ждать и выбрала тебя',
  clown: 'Клоун-кар переехал тебя. Смешно было только ему',
};
const RAM_TYPES = { car:1, clown:1 };

const DIFF_REWARD = { 1:{ coins:60, xp:30 }, 2:{ coins:110, xp:55 }, 3:{ coins:170, xp:85 } };

const GOAL_TEXT = {
  survive: g => `Продержись ${g.t} сек`,
  score:   g => `Набери ${g.n} очков`,
  cars:    g => `Пропусти ${g.n} машин` + (g.noCrash ? ' без ДТП' : ''),
  amb:     g => `Пропусти ${g.n} скорых`,
  cortege: g => `Проведи ${g.n} кортежа целыми`,
  cow:     g => `Пропусти ${g.n} коров`,
};
const GOAL_ICON = { survive:'⏱', score:'⭐', cars:'🚗', amb:'🚑', cortege:'💒', cow:'🐄' };

/* ---------- Магазин ---------- */
const BOOSTERS = [
  { id:'evac',  icon:'🏗️', name:'Эвакуатор', desc:'Убрать любую машину',      price:150 },
  { id:'siren', icon:'🚨', name:'Сирена',    desc:'Все замирают на 4 сек',    price:150 },
  { id:'donut', icon:'🍩', name:'Пончик',    desc:'Гнев всех водителей — 0',  price:100 },
  { id:'kit',   icon:'❤️', name:'Аптечка',   desc:'+1 жизнь на старте смены', price:250 },
];
const UPGRADES = [
  { id:'zen',      icon:'🪄', name:'Жезл дзена',       desc:'Перезарядка быстрее',      prices:[200,450,900], fx:l=>`${14-2*l} сек` },
  { id:'patience', icon:'🧘', name:'Терпение водителей',desc:'Злятся медленнее',         prices:[250,550,1000], fx:l=>`−${l*10}% гнева` },
  { id:'bonus',    icon:'🎁', name:'Премии чаще',      desc:'Премия каждые N очков',    prices:[300,600,1100], fx:l=>`каждые ${400-50*l}` },
];
const CHEST_PRICE = 400;

/* ---------- Гардероб ---------- */
const WARDROBE = {
  hat: [
    { id:'cap',     name:'Фуражка',     price:0,    icon:'🧢' },
    { id:'ushanka', name:'Ушанка',      price:300,  icon:'🥶' },
    { id:'cowboy',  name:'Шериф',       price:500,  icon:'🤠' },
    { id:'hardhat', name:'Каска',       price:350,  icon:'⛑️' },
    { id:'crown',   name:'Корона',      price:1200, icon:'👑' },
    { id:'cone',    name:'Конус',       price:600,  icon:'🚧' },
  ],
  uniform: [
    { id:'blue',   name:'Синяя',        price:0,    color:'#2D6FE0' },
    { id:'reflex', name:'Светоотражайка',price:250, color:'#C6F432' },
    { id:'khaki',  name:'Хаки',         price:250,  color:'#7E8B4A' },
    { id:'pink',   name:'Розовая',      price:400,  color:'#FF5FAE' },
    { id:'black',  name:'Спецназ',      price:500,  color:'#2A2E3F' },
    { id:'gold',   name:'Золотая',      price:1500, color:'#FFC400' },
  ],
  baton: [
    { id:'classic', name:'Классика',    price:0,    main:'#FF3B30', stripe:'#FFFFFF' },
    { id:'neon',    name:'Неон',        price:350,  main:'#3DFF7A', stripe:'#E6FFE9', glow:'#3DFF7A' },
    { id:'laser',   name:'Лазер',       price:700,  main:'#2FE6FF', stripe:'#FFFFFF', glow:'#2FE6FF' },
    { id:'baguette',name:'Багет',       price:400,  main:'#D9A05B', stripe:'#F6D7A0' },
    { id:'fish',    name:'Рыба',        price:600,  main:'#7FA7C9', stripe:'#C8DCEB', tip:'🐟' },
    { id:'gold',    name:'Золотой',     price:1500, main:'#FFC400', stripe:'#FFF3B0', glow:'#FFD60A' },
  ],
};

/* ---------- Звания ---------- */
const RANKS = [
  [1,'Стажёр'],[3,'Мл. сержант'],[5,'Сержант'],[8,'Старшина'],[12,'Лейтенант'],
  [16,'Капитан'],[20,'Майор'],[25,'Полковник'],[30,'Генерал жезла'],
];
const rankFor = lvl => { let r = RANKS[0][1]; for (const [l, n] of RANKS) if (lvl >= l) r = n; return r; };
const xpNeed = lvl => 80 + lvl * 40;

/* ---------- Ежедневные задания ---------- */
const DAILY = [
  { id:'cars',     icon:'🚗', text:'Пропусти 60 машин',     n:60, reward:60 },
  { id:'missions', icon:'⚠️', text:'Выполни 2 задания',     n:2,  reward:90 },
  { id:'amb',      icon:'🚑', text:'Пропусти 3 скорые',     n:3,  reward:70 },
];

/* ---------- Рация: абсурдные сводки ---------- */
const RADIO = [
  'Всем постам: гусь угнал самокат. Приметы — гусь.',
  'На Пушкина бабушка раздаёт пончики. Это не взятка, это любовь.',
  'Таксист утверждает, что знает короткий путь через твой перекрёсток.',
  'Жених потерял кольцо. И невесту. И кортеж.',
  'Трактор «Заря-3» заметили на МКАДе. Он едет к вам.',
  'Светофор на Мира ушёл в отпуск. Без предупреждения.',
  'Клоуны требуют отдельную полосу.',
  'Корова Зорька переходит дорогу по своим делам.',
];
const INSULTS = ['ТЫ ЧЕГО?!','ПАЛКА!','ДАВАЙ УЖЕ!','ЭЙ, ПАГОН!','Я ОПАЗДЫВАЮ!','ФУРАЖКУ СНИМИ!'];
