import { dimensionOf, isSpoon, type Unit } from './units';

/**
 * Praktisch afronden. Een recept voor drie personen mag geen 166,67 gram
 * vragen: in de keuken weeg je 170 gram af. De stapgrootte hangt af van hoe
 * groot de hoeveelheid is, want 5 gram meer op 800 gram merkt niemand, maar op
 * 10 gram wel.
 */

const roundToStep = (value: number, step: number): number =>
  Math.round((value + Number.EPSILON) / step) * step;

/** Stapgrootte voor massa (gram) en volume (milliliter). */
const metricStep = (value: number): number => {
  const v = Math.abs(value);
  if (v < 5) return 0.5;
  if (v < 20) return 1;
  if (v < 100) return 5;
  if (v < 1000) return 10;
  return 50;
};

/**
 * Afronden gebeurt in de eenheid waarin het recept het opschreef. Wie "2 el"
 * schrijft en halveert, wil "1 el" zien en niet "15 ml".
 */
export const roundInUnit = (amount: number, unit: Unit): number => {
  if (amount === 0) return 0;
  const dimension = dimensionOf(unit);

  if (dimension === 'aantal') {
    if (unit === 'snufje') return Math.max(1, Math.round(amount));
    // Een half ei of een half blikje bestaat; een derde ei niet.
    return Math.max(0.5, roundToStep(amount, 0.5));
  }

  if (isSpoon(unit)) {
    const step = amount < 1 ? 0.25 : 0.5;
    return Math.max(0.25, roundToStep(amount, step));
  }

  // Kilo's en liters worden in hun basiseenheid afgerond en daarna teruggerekend,
  // anders zou 0,9 kg op hele kilo's afgerond worden.
  const factor = unit === 'kg' || unit === 'l' ? 1000 : 1;
  const inBase = amount * factor;
  const rounded = roundToStep(inBase, metricStep(inBase));
  return Number((rounded / factor).toFixed(4));
};
