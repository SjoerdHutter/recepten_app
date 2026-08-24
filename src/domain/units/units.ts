/**
 * Eenheden zijn uitsluitend metrisch. Optellen gebeurt nooit rechtstreeks op de
 * getallen die in een recept staan, maar altijd op de basiseenheid van de
 * dimensie: gram voor massa, milliliter voor volume.
 */

export const UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'tl',
  'el',
  'stuks',
  'snufje',
  'teentje',
  'bosje',
] as const;

export type Unit = (typeof UNITS)[number];

/** Massa en volume rekenen door; "aantal" telt alleen op binnen dezelfde eenheid. */
export type Dimension = 'massa' | 'volume' | 'aantal';

interface UnitInfo {
  dimension: Dimension;
  /** Hoeveel basiseenheden één van deze eenheid is. */
  base: number;
  /** Woord in het enkelvoud; leeg als de eenheid niet uitgeschreven wordt. */
  singular: string;
  plural: string;
  /** Een lepel is een maat, geen stuk: bij kleine hoeveelheden leest el prettiger dan ml. */
  spoon?: boolean;
}

export const UNIT_INFO: Record<Unit, UnitInfo> = {
  g: { dimension: 'massa', base: 1, singular: 'g', plural: 'g' },
  kg: { dimension: 'massa', base: 1000, singular: 'kg', plural: 'kg' },
  ml: { dimension: 'volume', base: 1, singular: 'ml', plural: 'ml' },
  l: { dimension: 'volume', base: 1000, singular: 'l', plural: 'l' },
  tl: { dimension: 'volume', base: 5, singular: 'tl', plural: 'tl', spoon: true },
  el: { dimension: 'volume', base: 15, singular: 'el', plural: 'el', spoon: true },
  stuks: { dimension: 'aantal', base: 1, singular: '', plural: '' },
  snufje: { dimension: 'aantal', base: 1, singular: 'snufje', plural: 'snufjes' },
  teentje: { dimension: 'aantal', base: 1, singular: 'teentje', plural: 'teentjes' },
  bosje: { dimension: 'aantal', base: 1, singular: 'bosje', plural: 'bosjes' },
};

export interface Quantity {
  amount: number;
  unit: Unit;
}

export const dimensionOf = (unit: Unit): Dimension => UNIT_INFO[unit].dimension;

export const isSpoon = (unit: Unit): boolean => UNIT_INFO[unit].spoon === true;

/** Naar de basiseenheid van de dimensie (g, ml, of het aantal zelf). */
export const toBase = (q: Quantity): number => q.amount * UNIT_INFO[q.unit].base;

/**
 * Sleutel waaronder twee hoeveelheden bij elkaar opgeteld mogen worden.
 * Gram en kilo delen een sleutel, milliliter en liter ook, maar een teentje en
 * een bosje niet: dat zijn verschillende manieren van tellen.
 */
export const aggregationKey = (unit: Unit): string => {
  const dimension = dimensionOf(unit);
  return dimension === 'aantal' ? `aantal:${unit}` : dimension;
};

/**
 * Van basiseenheid terug naar de best leesbare eenheid.
 * `preferred` is de eenheid waarin het recept het opschreef; die wint zolang
 * het resultaat leesbaar blijft, zodat "2 el olie" niet als "30 ml" terugkomt.
 */
export const fromBase = (base: number, dimension: Dimension, preferred?: Unit): Quantity => {
  if (dimension === 'aantal') {
    return { amount: base, unit: preferred ?? 'stuks' };
  }
  if (dimension === 'massa') {
    if (base >= 1000) return { amount: base / 1000, unit: 'kg' };
    return { amount: base, unit: 'g' };
  }
  // volume
  if (preferred && isSpoon(preferred) && base < 100) {
    return { amount: base / UNIT_INFO[preferred].base, unit: preferred };
  }
  if (base >= 1000) return { amount: base / 1000, unit: 'l' };
  return { amount: base, unit: 'ml' };
};
