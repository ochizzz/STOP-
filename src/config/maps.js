/* ============ Карты: геометрия игровых участков (Map Configuration) ============
   v / h — число полос в каждую сторону на вертикальной / горизонтальной дороге.
   arms — какие стороны перекрёстка существуют (N — север/верх, S, W, E).
   lane — ширина полосы. Одна карта поддерживает разные сценарии уровней. */
export const MAPS = {
  cross:    { name: 'Перекрёсток',             arms: ['N', 'S', 'W', 'E'], v: 1, h: 1, lane: 36 },
  narrow:   { name: 'Узкий перекрёсток',       arms: ['N', 'S', 'W', 'E'], v: 1, h: 1, lane: 31, narrow: true },
  tee:      { name: 'Т-образный',              arms: ['S', 'W', 'E'],      v: 1, h: 1, lane: 36 },
  teeWide:  { name: 'Т-образный, 2 полосы',    arms: ['S', 'W', 'E'],      v: 1, h: 2, lane: 34 },
  avenue:   { name: 'Проспект и улица',        arms: ['N', 'S', 'W', 'E'], v: 1, h: 2, lane: 34 },
  big:      { name: 'Большой перекрёсток',     arms: ['N', 'S', 'W', 'E'], v: 2, h: 2, lane: 33 },
};

// Визуальные темы районов (только оформление, на правила не влияют)
export const THEMES = {
  oldtown:    { road: '#5A5F6E', walk: '#D9CDBA', ground: '#C9B89B', roofs: ['#C46A4A', '#B8573E', '#D9A066', '#8C6A5A'], walls: '#EADBC4', trees: .25 },
  sleep:      { road: '#565C6E', walk: '#E2E4E8', ground: '#A9CC8E', roofs: ['#9AA6B8', '#C4CBD6', '#E8C07A', '#88B4D8'], walls: '#F1F2F4', trees: .5 },
  center:     { road: '#4E5466', walk: '#E3E1DC', ground: '#BFC6CF', roofs: ['#5B6B86', '#7C8BA6', '#3E4A61', '#A9B4C6'], walls: '#DCE1E8', trees: .12 },
  market:     { road: '#575B68', walk: '#EBDCC1', ground: '#E3C68E', roofs: ['#E07A4F', '#F2B84B', '#4FA3A0', '#D9534F'], walls: '#F5E8D2', trees: .2 },
  industrial: { road: '#50545E', walk: '#C9C6BF', ground: '#A7A396', roofs: ['#7A8290', '#9C8C72', '#5E6B73', '#B07A4F'], walls: '#BDB8AE', trees: .1 },
  highway:    { road: '#474C5A', walk: '#D5D7DB', ground: '#9DBF7E', roofs: ['#8FA3B8', '#C9CED6', '#6E7F96'], walls: '#E3E6EA', trees: .35 },
};
