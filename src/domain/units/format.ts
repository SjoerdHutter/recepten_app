import { UNIT_INFO, dimensionOf, isSpoon, type Quantity, type Unit } from './units';

/**
 * Nederlandse notatie: komma als decimaalteken, en breuken als glyph waar dat
 * prettiger leest dan een kommagetal ("1½ el" in plaats van "1,5 el").
 */

const FRACTIONS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
};

const nlNumber = (value: number, maxDecimals = 2): string =>
  new Intl.NumberFormat('nl-NL', { maximumFractionDigits: maxDecimals }).format(value);

/** Breuken zijn alleen leesbaar bij stuks en lepels, niet bij grammen. */
const allowsFractionGlyph = (unit: Unit): boolean =>
  dimensionOf(unit) === 'aantal' || isSpoon(unit);

export const formatAmount = (amount: number, unit: Unit): string => {
  if (allowsFractionGlyph(unit)) {
    const whole = Math.floor(amount);
    const rest = Number((amount - whole).toFixed(2));
    const glyph = FRACTIONS[String(rest)];
    if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  }
  return nlNumber(amount);
};

/** "800 g", "1,5 kg", "2 teentjes", "1½ el", "3" (bij stuks). */
export const formatQuantity = (q: Quantity): string => {
  const info = UNIT_INFO[q.unit];
  const amount = formatAmount(q.amount, q.unit);
  const word = q.amount === 1 ? info.singular : info.plural;
  return word ? `${amount} ${word}` : amount;
};

/** "1 u 25 min", "45 min", "3 u". */
export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} u` : `${hours} u ${rest} min`;
};

/** Bedragen in euro, altijd met twee decimalen. */
export const formatEuro = (amount: number): string =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

export const formatNumber = nlNumber;
