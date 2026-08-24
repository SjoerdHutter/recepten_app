/**
 * Herkent tijdsaanduidingen in de tekst van een bereidingsstap, zodat je er in
 * de kookmodus een timer op kunt zetten zonder zelf te rekenen.
 *
 * Het `timer`-veld van een stap dekt dit niet af: dat staat er maar bij een deel
 * van de stappen, en een zin als "laat het een halfuur buiten de koelkast
 * liggen" heeft geen veld maar wel een tijd. Andersom hoort een stap met twee
 * tijden ("bak 10 minuten, laat daarna 5 minuten rusten") ook twee timers op te
 * leveren.
 */

export interface TimeMention {
  /** Positie in de oorspronkelijke tekst. */
  start: number;
  end: number;
  /** De tekst zoals die er staat, bijvoorbeeld "20 tot 25 minuten". */
  text: string;
  seconds: number;
}

const MINUUT = 60;
const UUR = 3600;

/** Woorden die een tijd zijn zonder dat er een getal bij staat. */
const WOORDTIJDEN: Array<[RegExp, number]> = [
  [/\bdrie\s?kwartier\b/gi, 45 * MINUUT],
  [/\banderhalf\s?uur\b/gi, 90 * MINUUT],
  [/\bandanderhalf\b/gi, 90 * MINUUT],
  [/\been\s?half\s?uur\b/gi, 30 * MINUUT],
  [/\bhalf\s?uur\b/gi, 30 * MINUUT],
  [/\been\s?kwartier\b/gi, 15 * MINUUT],
  [/\bkwartier\b/gi, 15 * MINUUT],
  [/\been\s?nacht\b/gi, 8 * UUR],
  [/\bnachtje\b/gi, 8 * UUR],
];

/** Eenheden achter een getal. "u" alleen los, anders vangt hij elk woord. */
const EENHEDEN: Array<[RegExp, number]> = [
  [/^(seconden|seconde|sec|s)$/i, 1],
  [/^(minuten|minuut|min|m)$/i, MINUUT],
  [/^(uren|uur|u)$/i, UUR],
];

/**
 * Uitgeschreven getallen. Recepten schrijven net zo vaak "laat drie uur stoven"
 * als "180 minuten", en zonder dit zou juist de belangrijkste tijd van een
 * stoofpot gemist worden.
 */
const WOORDGETALLEN: Record<string, number> = {
  een: 1,
  één: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vijf: 5,
  zes: 6,
  zeven: 7,
  acht: 8,
  negen: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
};

const WOORDGETAL_PATROON = new RegExp(
  `\\b(${Object.keys(WOORDGETALLEN).join('|')})\\s+(seconden|seconde|minuten|minuut|uren|uur)\\b`,
  'gi',
);

const eenheidNaarSeconden = (woord: string): number | null => {
  for (const [patroon, factor] of EENHEDEN) {
    if (patroon.test(woord)) return factor;
  }
  return null;
};

const leesGetal = (ruw: string): number => Number(ruw.replace(',', '.'));

/**
 * Een getal met een eenheid, eventueel als bereik. Bij "20 tot 25 minuten"
 * wordt de ondergrens genomen: in de keuken zet je de wekker op het moment
 * waarop je moet gaan kíjken, niet op het moment dat het klaar had moeten zijn.
 */
// Zonder afsluitende punt: "20 min." matcht ook zo, en een punt aan het eind
// van de zin hoort niet in de aantikbare knop te zitten.
const GETAL_PATROON = /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|tot|à|a)\s*\d+(?:[.,]\d+)?\s*)?([a-z]+)/gi;

export const findTimeMentions = (text: string): TimeMention[] => {
  const gevonden: TimeMention[] = [];
  const bezet = (start: number, end: number): boolean =>
    gevonden.some((m) => start < m.end && end > m.start);

  // Eerst de woordtijden: die mogen niet doorsneden worden door het getalpatroon.
  for (const [patroon, seconden] of WOORDTIJDEN) {
    patroon.lastIndex = 0;
    let treffer: RegExpExecArray | null;
    while ((treffer = patroon.exec(text)) !== null) {
      const start = treffer.index;
      const end = start + treffer[0].length;
      if (!bezet(start, end)) {
        gevonden.push({ start, end, text: treffer[0], seconds: seconden });
      }
    }
  }

  WOORDGETAL_PATROON.lastIndex = 0;
  let woordTreffer: RegExpExecArray | null;
  while ((woordTreffer = WOORDGETAL_PATROON.exec(text)) !== null) {
    const [heel, getal, eenheid] = woordTreffer;
    if (!getal || !eenheid) continue;
    const factor = eenheidNaarSeconden(eenheid);
    const aantal = WOORDGETALLEN[getal.toLowerCase()];
    if (factor === null || aantal === undefined) continue;
    const start = woordTreffer.index;
    const end = start + heel.length;
    if (bezet(start, end)) continue;
    gevonden.push({ start, end, text: heel, seconds: aantal * factor });
  }

  GETAL_PATROON.lastIndex = 0;
  let treffer: RegExpExecArray | null;
  while ((treffer = GETAL_PATROON.exec(text)) !== null) {
    const [heel, getal, eenheid] = treffer;
    if (!getal || !eenheid) continue;
    const factor = eenheidNaarSeconden(eenheid);
    if (factor === null) continue;
    const seconds = Math.round(leesGetal(getal) * factor);
    if (seconds <= 0) continue;
    const start = treffer.index;
    const end = start + heel.length;
    if (bezet(start, end)) continue;
    gevonden.push({ start, end, text: heel.trim(), seconds });
  }

  return gevonden.sort((a, b) => a.start - b.start);
};

/** "1 u 25 min", maar dan als aftellende klok: "1:25:00" of "25:00". */
export const formatClock = (totalSeconds: number): string => {
  const seconden = Math.max(0, Math.round(totalSeconds));
  const uren = Math.floor(seconden / 3600);
  const minuten = Math.floor((seconden % 3600) / 60);
  const rest = seconden % 60;
  const tweecijferig = (waarde: number) => String(waarde).padStart(2, '0');
  return uren > 0
    ? `${uren}:${tweecijferig(minuten)}:${tweecijferig(rest)}`
    : `${minuten}:${tweecijferig(rest)}`;
};
