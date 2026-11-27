/* ============ Транспорт и характеры водителей (Vehicle Configuration) ============ */

// len/wid — габариты (мировые единицы), vmax — скорость, accel/brake — разгон/торможение.
// pts — очки за проезд, chars — вероятности характеров водителя.
export const VEHICLES = {
  car:    { name: 'Легковушка',   len: 44, wid: 26, vmax: 110, accel: 190, brake: 330, pts: 10, colors: ['#3E7BEA', '#E8574A', '#3DBB6A', '#F0A23A', '#8E62E0', '#2FB5B5', '#E85F9C', '#EEF1F6', '#4A5568'], chars: { calm: 5, newbie: 2, sport: 1.2, rich: 1, pensioner: 1.3, aggressive: 1 } },
  taxi:   { name: 'Такси',        len: 46, wid: 26, vmax: 128, accel: 220, brake: 340, pts: 10, color: '#FFC83D', chars: { taxi: 1 } },
  bus:    { name: 'Автобус',      len: 80, wid: 30, vmax: 80,  accel: 85,  brake: 260, pts: 20, color: '#F29F3A', chars: { busdriver: 1 } },
  truck:  { name: 'Грузовик',     len: 72, wid: 31, vmax: 76,  accel: 75,  brake: 240, pts: 20, color: '#5267B5', wide: true, chars: { calm: 2, aggressive: .7 } },
  amb:    { name: 'Скорая',       len: 54, wid: 28, vmax: 150, accel: 240, brake: 360, pts: 30, color: '#FFFFFF', emergency: true, chars: { calm: 1 } },
  police: { name: 'Полиция',      len: 48, wid: 27, vmax: 140, accel: 240, brake: 360, pts: 30, color: '#2E5AAC', emergency: true, chars: { calm: 1 } },
  limo:   { name: 'Лимузин',      len: 66, wid: 27, vmax: 105, accel: 170, brake: 320, pts: 20, color: '#FFFFFF', chars: { calm: 1 } },
  wcar:   { name: 'Свадебная',    len: 44, wid: 26, vmax: 105, accel: 180, brake: 320, pts: 15, color: '#FFC4DE', chars: { calm: 1 } },
  vip:    { name: 'Кортеж VIP',   len: 52, wid: 27, vmax: 120, accel: 200, brake: 330, pts: 25, color: '#1E2230', chars: { rich: 1 } },
  clown:  { name: 'Клоун-кар',    len: 42, wid: 27, vmax: 105, accel: 200, brake: 320, pts: 40, color: '#FF5FAE', stalls: true, chars: { newbie: 1 } },
  cow:    { name: 'Корова',       len: 36, wid: 26, vmax: 30,  accel: 60,  brake: 200, pts: 50, animal: true, stare: true, chars: { pensioner: 1 } },
  tractor:{ name: 'Трактор',      len: 46, wid: 30, vmax: 46,  accel: 70,  brake: 260, pts: 30, color: '#3DBB6A', chars: { pensioner: 1 } },
};

// Характер влияет на поведение, но не создаёт нечестных ситуаций:
// риск — только при конфликте зелёных или после явного предупреждения (кипит).
export const CHARACTERS = {
  calm:       { name: 'Спокойный',         patience: 1.0, risk: 0,   rage: 'honk' },
  taxi:       { name: 'Таксист',           patience: 2.0, risk: .35, rage: 'run', creeps: true },
  pensioner:  { name: 'Пенсионер',         patience: .5,  risk: 0,   rage: 'honk', speed: .8, accel: .8 },
  newbie:     { name: 'Новичок',           patience: 1.0, risk: 0,   rage: 'honk', hesitate: .9 },
  aggressive: { name: 'Агрессивный',       patience: 2.2, risk: .5,  rage: 'ram' },
  sport:      { name: 'Спортсмен',         patience: 1.3, risk: .15, rage: 'run', speed: 1.15, accel: 1.6 },
  rich:       { name: 'Богач',             patience: 1.5, risk: .2,  rage: 'run', ignoresPrepare: true },
  busdriver:  { name: 'Водитель автобуса', patience: .8,  risk: 0,   rage: 'honk', accel: .85 },
};

// Реплики (п. 6.3 ТЗ). Показываются коротким облачком, не перекрывают поле.
export const LINES = {
  wait: ['Начальник, я тут уже прописался', 'Я только спросить', 'У меня ребёнок в машине!', 'А если я аккуратно проеду?', 'Вы вообще работаете?', 'Я вызываю своего брата', 'У меня доставка, брат'],
  taxi: ['Счётчик тикает!', 'Я знаю короткий путь', 'Шеф, давай уже'],
  pensioner: ['Я в 1974-м тут быстрее ехал', 'Ничего, я подожду… наверное'],
  rich: ['Вы знаете, кто я?', 'Мне можно'],
  aggressive: ['ДАВАЙ УЖЕ!', 'ФУРАЖКУ СНИМИ!', 'ПАЛКА!'],
  newbie: ['Это мне зелёный или не мне?', 'Ой. Ой-ой.'],
  bus: ['У меня график!', 'Следующая остановка — твоя совесть'],
  run: ['Я ЗНАЮ КОРОТКИЙ ПУТЬ!', 'ПРОРЫВАЮСЬ!', 'МНЕ МОЖНО!'],
  ram: ['ТЕБЕ КОНЕЦ!', 'ПОСТОРОНИСЬ!'],
};
