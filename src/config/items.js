/* ============ Магазин и инвентарь (Item Configuration) ============
   Только косметика: механики управления не продаются (п. 15 ТЗ, без Pay-to-Win).
   currency: 'cash' | 'tokens'. rarity: common | rare | epic | legendary. */
export const CATEGORIES = [
  { id: 'uniform',   name: 'Форма' },
  { id: 'baton',     name: 'Жезлы' },
  { id: 'hat',       name: 'Головные уборы' },
  { id: 'accessory', name: 'Аксессуары' },
  { id: 'effect',    name: 'Эффекты' },
];

export const ITEMS = [
  // форма
  { id: 'u-blue',    cat: 'uniform', name: 'Синяя',            rarity: 'common',    price: 0,    currency: 'cash', color: '#2D6FE0' },
  { id: 'u-reflex',  cat: 'uniform', name: 'Светоотражайка',   rarity: 'common',    price: 250,  currency: 'cash', color: '#C6F432' },
  { id: 'u-khaki',   cat: 'uniform', name: 'Хаки',             rarity: 'common',    price: 250,  currency: 'cash', color: '#7E8B4A' },
  { id: 'u-pink',    cat: 'uniform', name: 'Розовая',          rarity: 'rare',      price: 450,  currency: 'cash', color: '#FF5FAE' },
  { id: 'u-black',   cat: 'uniform', name: 'Спецназ',          rarity: 'rare',      price: 600,  currency: 'cash', color: '#2A2E3F' },
  { id: 'u-gold',    cat: 'uniform', name: 'Золотая',          rarity: 'legendary', price: 8,    currency: 'tokens', color: '#FFC400' },
  // жезлы
  { id: 'b-classic', cat: 'baton', name: 'Классика',  rarity: 'common',    price: 0,   currency: 'cash',   main: '#FF3B30', stripe: '#FFFFFF' },
  { id: 'b-neon',    cat: 'baton', name: 'Неон',      rarity: 'rare',      price: 400, currency: 'cash',   main: '#3DFF7A', stripe: '#E6FFE9', glow: '#3DFF7A' },
  { id: 'b-laser',   cat: 'baton', name: 'Лазер',     rarity: 'epic',      price: 3,   currency: 'tokens', main: '#2FE6FF', stripe: '#FFFFFF', glow: '#2FE6FF' },
  { id: 'b-baguette',cat: 'baton', name: 'Багет',     rarity: 'rare',      price: 450, currency: 'cash',   main: '#D9A05B', stripe: '#F6D7A0' },
  { id: 'b-fish',    cat: 'baton', name: 'Рыба',      rarity: 'epic',      price: 700, currency: 'cash',   main: '#7FA7C9', stripe: '#C8DCEB' },
  { id: 'b-gold',    cat: 'baton', name: 'Золотой',   rarity: 'legendary', price: 6,   currency: 'tokens', main: '#FFC400', stripe: '#FFF3B0', glow: '#FFD60A' },
  // головные уборы
  { id: 'h-cap',     cat: 'hat', name: 'Фуражка',  rarity: 'common',    price: 0,    currency: 'cash',   icon: '🧢' },
  { id: 'h-ushanka', cat: 'hat', name: 'Ушанка',   rarity: 'common',    price: 300,  currency: 'cash',   icon: '🧣' },
  { id: 'h-cowboy',  cat: 'hat', name: 'Шериф',    rarity: 'rare',      price: 550,  currency: 'cash',   icon: '🤠' },
  { id: 'h-hardhat', cat: 'hat', name: 'Каска',    rarity: 'common',    price: 350,  currency: 'cash',   icon: '⛑️' },
  { id: 'h-cone',    cat: 'hat', name: 'Конус',    rarity: 'epic',      price: 800,  currency: 'cash',   icon: '🚧' },
  { id: 'h-crown',   cat: 'hat', name: 'Корона',   rarity: 'legendary', price: 10,   currency: 'tokens', icon: '👑' },
  // аксессуары (видны на модели регулировщика)
  { id: 'a-none',    cat: 'accessory', name: 'Без аксессуара', rarity: 'common', price: 0,   currency: 'cash',   icon: '➖' },
  { id: 'a-glasses', cat: 'accessory', name: 'Тёмные очки',    rarity: 'rare',   price: 400, currency: 'cash',   icon: '🕶️' },
  { id: 'a-medal',   cat: 'accessory', name: 'Медаль',         rarity: 'epic',   price: 2,   currency: 'tokens', icon: '🎖️' },
  { id: 'a-whistle', cat: 'accessory', name: 'Золотой свисток', rarity: 'epic',  price: 900, currency: 'cash',   icon: '📯' },
  // эффекты (празднование победы)
  { id: 'e-confetti',cat: 'effect', name: 'Конфетти',   rarity: 'common', price: 0,   currency: 'cash',   icon: '🎉', burst: ['🎉', '⭐'] },
  { id: 'e-hearts',  cat: 'effect', name: 'Сердечки',   rarity: 'rare',   price: 350, currency: 'cash',   icon: '💖', burst: ['💖', '💗'] },
  { id: 'e-money',   cat: 'effect', name: 'Премия',     rarity: 'epic',   price: 3,   currency: 'tokens', icon: '💵', burst: ['💵', '💰'] },
];
export const itemById = id => ITEMS.find(i => i.id === id);
export const DEFAULT_EQUIP = { uniform: 'u-blue', baton: 'b-classic', hat: 'h-cap', accessory: 'a-none', effect: 'e-confetti' };
export const RARITY = { common: { name: 'Обычный', color: '#8A93A6' }, rare: { name: 'Редкий', color: '#2F80ED' }, epic: { name: 'Эпический', color: '#9B51E0' }, legendary: { name: 'Легендарный', color: '#F2A900' } };
