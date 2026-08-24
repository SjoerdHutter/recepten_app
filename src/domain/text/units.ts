import type { Unit } from '../units/units';

/**
 * Hoe mensen eenheden opschrijven. De sleutel is wat er in de tekst staat, de
 * waarde de eenheid van de app.
 */
export const UNIT_WORDS: Record<string, Unit> = {
  g: 'g',
  gr: 'g',
  gram: 'g',
  grammen: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogram: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  cl: 'ml',
  dl: 'ml',
  l: 'l',
  liter: 'l',
  tl: 'tl',
  theelepel: 'tl',
  theelepels: 'tl',
  el: 'el',
  eetlepel: 'el',
  eetlepels: 'el',
  st: 'stuks',
  stuk: 'stuks',
  stuks: 'stuks',
  snuf: 'snufje',
  snufje: 'snufje',
  snufjes: 'snufje',
  teen: 'teentje',
  tenen: 'teentje',
  teentje: 'teentje',
  teentjes: 'teentje',
  bos: 'bosje',
  bosje: 'bosje',
  bosjes: 'bosje',
  stengel: 'stengel',
  stengels: 'stengel',
  takje: 'takje',
  takjes: 'takje',
  blad: 'blad',
  blaadje: 'blad',
  blaadjes: 'blad',
};

/** Centiliter en deciliter bestaan wel op verpakkingen, maar niet in het schema. */
export const UNIT_MULTIPLIER: Record<string, number> = { cl: 10, dl: 100 };
