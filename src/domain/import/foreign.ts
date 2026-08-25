import type { Unit } from '../units/units';

/**
 * Buitenlandse maten omrekenen naar metrisch.
 *
 * Een geïmporteerd recept schrijft "1 1/2 cups flour" of "bake at 350°F", en
 * daar valt in een Nederlandse keuken niets mee te beginnen. Deze module rekent
 * dat om, maar houdt zich aan één regel: liever niets omrekenen dan iets
 * verkeerd omrekenen. Een cup meel weegt niet hetzelfde als een cup suiker, dus
 * volume gaat naar milliliter en nooit rechtstreeks naar gram — het wegen laat
 * de app aan de dichtheden in de bibliotheek over.
 */

interface ForeignUnit {
  /** Naar welke eenheid van de app. */
  unit: Unit;
  /** Met welke factor de hoeveelheid vermenigvuldigd wordt. */
  factor: number;
}

/**
 * De sleutel is het woord zoals het in de tekst staat, kleingeschreven en
 * zonder punt. Amerikaanse maten, want dat is wat receptensites gebruiken; de
 * Britse pint en fluid ounce wijken af en staan er daarom niet in.
 */
export const FOREIGN_UNITS: Record<string, ForeignUnit> = {
  cup: { unit: 'ml', factor: 240 },
  cups: { unit: 'ml', factor: 240 },
  c: { unit: 'ml', factor: 240 },

  tablespoon: { unit: 'el', factor: 1 },
  tablespoons: { unit: 'el', factor: 1 },
  tbsp: { unit: 'el', factor: 1 },
  tbs: { unit: 'el', factor: 1 },
  tbspn: { unit: 'el', factor: 1 },
  teaspoon: { unit: 'tl', factor: 1 },
  teaspoons: { unit: 'tl', factor: 1 },
  tsp: { unit: 'tl', factor: 1 },
  tspn: { unit: 'tl', factor: 1 },

  ounce: { unit: 'g', factor: 28.35 },
  ounces: { unit: 'g', factor: 28.35 },
  oz: { unit: 'g', factor: 28.35 },
  pound: { unit: 'g', factor: 453.6 },
  pounds: { unit: 'g', factor: 453.6 },
  lb: { unit: 'g', factor: 453.6 },
  lbs: { unit: 'g', factor: 453.6 },

  'fluid ounce': { unit: 'ml', factor: 29.57 },
  'fluid ounces': { unit: 'ml', factor: 29.57 },
  'fl oz': { unit: 'ml', factor: 29.57 },
  floz: { unit: 'ml', factor: 29.57 },
  pint: { unit: 'ml', factor: 473 },
  pints: { unit: 'ml', factor: 473 },
  quart: { unit: 'l', factor: 0.946 },
  quarts: { unit: 'l', factor: 0.946 },
  gallon: { unit: 'l', factor: 3.785 },
  gallons: { unit: 'l', factor: 3.785 },

  // Een Amerikaans pakje boter is 113 g; het staat op de wikkel gemarkeerd,
  // dus recepten meten er echt in af.
  stick: { unit: 'g', factor: 113 },
  sticks: { unit: 'g', factor: 113 },

  // Engelse woorden voor maten die de app al kent.
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  kilogram: { unit: 'kg', factor: 1 },
  kilograms: { unit: 'kg', factor: 1 },
  milliliter: { unit: 'ml', factor: 1 },
  milliliters: { unit: 'ml', factor: 1 },
  millilitre: { unit: 'ml', factor: 1 },
  millilitres: { unit: 'ml', factor: 1 },
  liter: { unit: 'l', factor: 1 },
  liters: { unit: 'l', factor: 1 },
  litre: { unit: 'l', factor: 1 },
  litres: { unit: 'l', factor: 1 },
  clove: { unit: 'teentje', factor: 1 },
  cloves: { unit: 'teentje', factor: 1 },
  bunch: { unit: 'bosje', factor: 1 },
  bunches: { unit: 'bosje', factor: 1 },
  sprig: { unit: 'takje', factor: 1 },
  sprigs: { unit: 'takje', factor: 1 },
  stalk: { unit: 'stengel', factor: 1 },
  stalks: { unit: 'stengel', factor: 1 },
  leaf: { unit: 'blad', factor: 1 },
  leaves: { unit: 'blad', factor: 1 },
  pinch: { unit: 'snufje', factor: 1 },
  pinches: { unit: 'snufje', factor: 1 },
  piece: { unit: 'stuks', factor: 1 },
  pieces: { unit: 'stuks', factor: 1 },
};

/**
 * Rekent een hoeveelheid met een buitenlandse maat om. Kent de app het woord
 * niet, dan komt er niets terug en blijft de regel staan zoals hij was.
 */
export const convertForeign = (
  amount: number,
  word: string,
): { amount: number; unit: Unit } | null => {
  const sleutel = word.toLowerCase().replace(/\./g, '').trim();
  const maat = FOREIGN_UNITS[sleutel];
  if (!maat) return null;
  return { amount: amount * maat.factor, unit: maat.unit };
};

/** Van Fahrenheit naar Celsius, afgerond op vijf graden. */
export const fahrenheitToCelsius = (fahrenheit: number): number =>
  Math.round(((fahrenheit - 32) * 5) / 9 / 5) * 5;

const GRADEN =
  /(\d{2,3})\s*(?:°\s*|degrees?\s+)?(?:F\b|Fahrenheit\b)(?:\s*\(\s*\d{2,3}\s*°?\s*C\w*\s*\)|\s*\/\s*\d{2,3}\s*°?\s*C\w*)?/gi;

/**
 * Vervangt elke temperatuur in Fahrenheit in een lap tekst door graden Celsius.
 * Staat er al een omrekening tussen haakjes ("350°F (175°C)"), dan verdwijnt
 * die mee: twee temperaturen achter elkaar leest niemand prettig.
 */
export const convertTemperatures = (tekst: string): string =>
  tekst.replace(GRADEN, (_, graden: string) => `${fahrenheitToCelsius(Number(graden))} °C`);

/**
 * Haalt de oventemperatuur uit een stap, in graden Celsius. Zoekt eerst naar
 * Fahrenheit en dan pas naar Celsius, want een Amerikaans recept schrijft vaak
 * allebei en de Fahrenheit staat dan voorop.
 */
export const ovenTempFrom = (tekst: string): number | undefined => {
  const celsius = /(\d{2,3})\s*(?:°\s*|graden\s+|degrees?\s+)?C\b/i.exec(tekst);
  if (celsius?.[1]) return Number(celsius[1]);
  const fahrenheit = /(\d{2,3})\s*(?:°\s*|degrees?\s+)?F\b/i.exec(tekst);
  if (fahrenheit?.[1]) return fahrenheitToCelsius(Number(fahrenheit[1]));
  return undefined;
};

/**
 * Engelse meervoudsvormen, zodat "tomatoes" en "berries" bij het Engelse veld
 * in de bibliotheek uitkomen. De Nederlandse vormen zitten al in `nameVariants`.
 */
export const englishSingular = (name: string): string[] => {
  const woorden = name.trim().toLowerCase();
  const vormen = new Set<string>();
  if (woorden.endsWith('ies')) vormen.add(`${woorden.slice(0, -3)}y`);
  if (woorden.endsWith('es')) vormen.add(woorden.slice(0, -2));
  if (woorden.endsWith('ves')) vormen.add(`${woorden.slice(0, -3)}f`);
  if (woorden.endsWith('s')) vormen.add(woorden.slice(0, -1));
  vormen.delete(woorden);
  return [...vormen];
};

/**
 * Woorden die in een Engelse ingrediëntregel voor de naam staan en er niet bij
 * horen. "1 large onion, finely chopped" moet bij "onion" uitkomen.
 */
const ENGELSE_VULWOORDEN =
  /^(?:large|small|medium|big|whole|fresh|freshly|dried|ground|chopped|finely|roughly|thinly|ripe|raw|cooked|good|quality|extra|organic|free-range|plain|unsalted|salted|of)\s+/i;

export const stripEnglishFiller = (naam: string): string => {
  let uit = naam.trim();
  let vorige = '';
  while (uit && uit !== vorige) {
    vorige = uit;
    uit = uit.replace(ENGELSE_VULWOORDEN, '');
  }
  return uit || naam.trim();
};
