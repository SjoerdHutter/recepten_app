import type { IngredientLibrary } from '../ingredients/library';
import type { Ingredient } from '../schema/ingredient';
import type { Scaling } from '../schema/recipe';
import { parseAmount, type ParsedIngredient } from '../text/parse';
import { UNIT_MULTIPLIER, UNIT_WORDS } from '../text/units';
import type { Unit } from '../units/units';
import { convertForeign, englishSingular, stripEnglishFiller } from './foreign';

/**
 * Eén ingrediëntregel uit een geïmporteerd recept.
 *
 * Websites schrijven `recipeIngredient` als losse zinnetjes: "1 1/2 cups
 * all-purpose flour", "2 uien, gesnipperd", "Salt and pepper to taste". Deze
 * parser is een neefje van de plakparser, maar hij hoeft niet te raden of een
 * regel wel een ingrediënt ís — dat heeft de site al gezegd. Daardoor kan hij
 * agressiever zijn met wat hij van de regel maakt, en dat is precies wat een
 * Engelse regel nodig heeft.
 */

const AANHEF = /^[-*•‣]\s*|^\d{1,2}[.)]\s*/;
const BREUKEN: Record<string, string> = {
  '½': '1/2',
  '¼': '1/4',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
};

/**
 * "1 1/2" en "1½" zijn anderhalf; los geschreven zou de parser er 1 van maken
 * en de helft weggooien. Daarom worden gemengde getallen eerst opgeteld.
 */
export const normalizeFractions = (tekst: string): string => {
  let uit = tekst;
  for (const [teken, breuk] of Object.entries(BREUKEN)) {
    uit = uit.replace(new RegExp(teken, 'g'), ` ${breuk}`);
  }
  return uit
    .replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, (_, heel: string, teller: string, noemer: string) =>
      String(Number(heel) + Number(teller) / Number(noemer)),
    )
    .replace(/(\d+)\s*\/\s*(\d+)/g, (_, teller: string, noemer: string) =>
      String(Number(teller) / Number(noemer)),
    )
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Zoekt het ingrediënt bij een vrij geschreven naam, Nederlands of Engels.
 * Van links naar rechts steeds een woord eraf, want "all-purpose flour" staat
 * niet in de bibliotheek en "flour" wel.
 */
export const matchImportedName = (
  naam: string,
  library: IngredientLibrary,
): Ingredient | undefined => {
  const kandidaten = [naam, stripEnglishFiller(naam)];
  for (const kandidaat of kandidaten) {
    const woorden = kandidaat.split(/[\s-]+/).filter(Boolean);
    for (let start = 0; start < woorden.length; start++) {
      const deel = woorden.slice(start).join(' ');
      const direct = library.match(deel);
      if (direct) return direct;
      for (const enkelvoud of englishSingular(deel)) {
        const treffer = library.match(enkelvoud);
        if (treffer) return treffer;
      }
      // Ook het laatste woord alleen: "olive oil" vindt "oil" niet als de
      // bibliotheek alleen "olijfolie" kent, maar "flour" in "cups flour" wel.
      const laatste = woorden[woorden.length - 1];
      if (start === 0 && laatste && woorden.length > 1) {
        const staart = library.match(laatste) ?? library.match(englishSingular(laatste)[0] ?? '');
        if (staart) return staart;
      }
    }
  }
  return undefined;
};

const NAAR_SMAAK = /,?\s*(?:to taste|naar smaak|as needed|optional|indien gewenst)\s*$/i;

/** Woorden die na een komma of tussen haakjes staan zijn een toelichting. */
const splitsNotitie = (rest: string): { naam: string; note: string } => {
  const notities: string[] = [];
  const zonderHaakjes = rest
    .replace(/\(([^)]*)\)/g, (_, inhoud: string) => {
      notities.push(inhoud.trim());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  const komma = zonderHaakjes.indexOf(',');
  const naam = komma >= 0 ? zonderHaakjes.slice(0, komma) : zonderHaakjes;
  if (komma >= 0) notities.unshift(zonderHaakjes.slice(komma + 1));

  return {
    naam: naam.trim(),
    note: notities
      .map((deel) => deel.trim())
      .filter(Boolean)
      .join(', '),
  };
};

/**
 * Kijkt of de regel met een maat begint. Eerst twee woorden ("fluid ounces"),
 * dan één; buitenlandse maten gaan voor, want "cup" en "pint" komen in de
 * Nederlandse lijst niet voor en "liter" in allebei — met hetzelfde resultaat.
 */
const leesEenheid = (
  woorden: string[],
): { unit: Unit; factor: number; verbruikt: number } | null => {
  const paar = woorden.slice(0, 2).join(' ').toLowerCase().replace(/\./g, '');
  const buitenlandsPaar = convertForeign(1, paar);
  if (buitenlandsPaar && woorden.length >= 2) {
    return { unit: buitenlandsPaar.unit, factor: buitenlandsPaar.amount, verbruikt: 2 };
  }

  const eerste = (woorden[0] ?? '').toLowerCase().replace(/\.$/, '');
  if (!eerste) return null;

  const buitenlands = convertForeign(1, eerste);
  if (buitenlands) return { unit: buitenlands.unit, factor: buitenlands.amount, verbruikt: 1 };

  const nederlands = UNIT_WORDS[eerste];
  if (nederlands) return { unit: nederlands, factor: UNIT_MULTIPLIER[eerste] ?? 1, verbruikt: 1 };

  return null;
};

/**
 * Maakt van één regel een ingrediënt. Lukt dat niet, dan komt er `null` terug
 * en hoort de regel bij de niet-geplaatste regels van de controlestap — nooit
 * stilletjes weg.
 */
export const parseImportLine = (
  regel: string,
  library: IngredientLibrary,
): ParsedIngredient | null => {
  const schoon = normalizeFractions(regel.replace(AANHEF, '').trim());
  if (!schoon) return null;

  const naarSmaak = NAAR_SMAAK.test(schoon);
  const zonderSmaak = schoon.replace(NAAR_SMAAK, '').trim();
  if (!zonderSmaak) return null;

  const getal = /^(\d+(?:[.,]\d+)?(?:\s*(?:-|–|to|tot|à)\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/s.exec(
    zonderSmaak,
  );
  const amount = getal?.[1] ? parseAmount(getal[1]) : undefined;
  const rest = (getal?.[1] ? (getal[2] ?? '') : zonderSmaak).trim();

  const woorden = rest.split(/\s+/).filter(Boolean);
  const maat = amount === undefined ? null : leesEenheid(woorden);
  const naamDeel = maat ? woorden.slice(maat.verbruikt).join(' ') : rest;

  const { naam, note } = splitsNotitie(naamDeel);
  if (!naam) return null;

  const gevonden = matchImportedName(naam, library);
  const scales: Scaling | undefined = naarSmaak ? 'taste' : undefined;

  // Een hoeveelheid zonder maat is een aantal: "2 onions" zijn 2 stuks. Zonder
  // hoeveelheid blijft de regel maatloos, net als "peper naar smaak".
  const hoeveelheid = maat ? (amount ?? 1) * maat.factor : amount;
  const unit: Unit | undefined = maat ? maat.unit : amount === undefined ? undefined : 'stuks';

  return {
    ...(hoeveelheid !== undefined && unit ? { amount: afronden(hoeveelheid), unit } : {}),
    ...(gevonden ? { ingredientId: gevonden.id } : {}),
    name: gevonden?.name ?? naam,
    ...(note ? { note } : {}),
    ...(scales ? { scales } : {}),
  };
};

/**
 * 226,79999 gram is geen hoeveelheid die iemand opschrijft. Omgerekende maten
 * worden daarom afgerond: boven de 10 op hele eenheden, daaronder op één cijfer
 * achter de komma, want een halve theelepel moet wel een halve blijven.
 */
const afronden = (waarde: number): number =>
  waarde >= 10 ? Math.round(waarde) : Math.round(waarde * 10) / 10;
