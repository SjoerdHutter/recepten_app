import type { Scaling } from '../schema/recipe';
import type { IngredientLibrary } from '../ingredients/library';
import { normalizeName } from '../ingredients/library';
import type { Unit } from '../units/units';
import { UNIT_MULTIPLIER, UNIT_WORDS } from './units';

/**
 * Parser voor een recept dat je als platte tekst plakt. Hij is met opzet
 * voorzichtig: alles wat hij niet zeker weet komt in `leftovers` terecht in
 * plaats van dat het geraden wordt. Het resultaat is altijd bedoeld om daarna
 * met de hand na te lopen.
 */

export interface ParsedIngredient {
  amount?: number;
  unit?: Unit;
  ingredientId?: string;
  name: string;
  note?: string;
  scales?: Scaling;
}

export interface ParsedRecipe {
  title: string;
  servings?: number;
  times: { prep: number; active: number; passive: number };
  ingredients: ParsedIngredient[];
  steps: string[];
  /** Regels waar de parser geen raad mee wist. */
  leftovers: string[];
}

const KOP_INGREDIENTEN = /^(ingredi[eë]nten|benodigdheden|boodschappen|nodig)\b/i;
const KOP_BEREIDING = /^(bereiding|bereidingswijze|stappen|instructies|werkwijze|aan de slag)\b/i;
const PERSONEN = /(?:voor\s+)?(\d+)\s*(?:personen|porties|pers\b)/i;
const BREUKEN: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** "1,5", "1/2", "½", "2-3" (dan het eerste getal). */
const leesGetal = (ruw: string): number | undefined => {
  const tekst = ruw.trim();
  if (BREUKEN[tekst] !== undefined) return BREUKEN[tekst];
  const gemengd = /^(\d+)\s*([½¼¾⅓⅔])$/.exec(tekst);
  if (gemengd?.[1] && gemengd[2]) return Number(gemengd[1]) + (BREUKEN[gemengd[2]] ?? 0);
  const breuk = /^(\d+)\s*\/\s*(\d+)$/.exec(tekst);
  if (breuk?.[1] && breuk[2]) return Number(breuk[1]) / Number(breuk[2]);
  const bereik = /^(\d+(?:[.,]\d+)?)\s*(?:-|tot|à)\s*\d/.exec(tekst);
  if (bereik?.[1]) return Number(bereik[1].replace(',', '.'));
  const enkel = /^(\d+(?:[.,]\d+)?)$/.exec(tekst);
  return enkel?.[1] ? Number(enkel[1].replace(',', '.')) : undefined;
};

const minutenIn = (regel: string): number | undefined => {
  const uren = /(\d+)\s*(?:uur|u)\b/i.exec(regel);
  const minuten = /(\d+)\s*(?:minuten|minuut|min)\b/i.exec(regel);
  if (!uren && !minuten) return undefined;
  return (uren?.[1] ? Number(uren[1]) * 60 : 0) + (minuten?.[1] ? Number(minuten[1]) : 0);
};

const AANHEF = /^[-*•‣]\s*|^\d{1,2}[.)]\s*/;

/**
 * "Peper en zout naar smaak" heeft geen hoeveelheid. Staan er twee namen die
 * allebei in de bibliotheek voorkomen, dan worden het twee regels.
 */
const leesNaarSmaak = (regel: string, library: IngredientLibrary): ParsedIngredient[] | null => {
  const schoon = regel.replace(AANHEF, '').trim();
  if (!/naar smaak\s*$/i.test(schoon)) return null;
  const namen = schoon
    .replace(/naar smaak\s*$/i, '')
    .replace(/[,:]\s*$/, '')
    .split(/\s+en\s+/)
    .map((deel) => deel.trim())
    .filter(Boolean);
  if (namen.length === 0) return null;
  const gekoppeld = namen.map((naam) => ({ naam, ingredient: library.match(naam) }));
  const bruikbaar = gekoppeld.length === 1 || gekoppeld.every((deel) => deel.ingredient);
  const delen = bruikbaar ? gekoppeld : [{ naam: namen.join(' en '), ingredient: undefined }];
  return delen.map((deel) => ({
    ...(deel.ingredient ? { ingredientId: deel.ingredient.id } : {}),
    name: deel.ingredient?.name ?? deel.naam,
    scales: 'taste' as Scaling,
  }));
};

/**
 * Een ingrediëntregel begint met een hoeveelheid, of met een eenheidswoord
 * ("snufje zout"). Zo niet, dan is het waarschijnlijk een stap of een kopje.
 */
const leesIngredient = (regel: string, library: IngredientLibrary): ParsedIngredient | null => {
  const schoon = regel.replace(AANHEF, '').trim();
  if (!schoon) return null;

  const match = /^([\d.,/½¼¾⅓⅔]+(?:\s*(?:-|tot|à)\s*[\d.,]+)?)?\s*([a-zA-Zé]+\.?)?\s*(.*)$/.exec(
    schoon,
  );
  if (!match) return null;

  const [, getalDeel, woordDeel, restDeel] = match;
  const amount = getalDeel ? leesGetal(getalDeel) : undefined;
  const woord = (woordDeel ?? '').replace(/\.$/, '').toLowerCase();
  const eenheid = UNIT_WORDS[woord];

  let rest = restDeel ?? '';
  let unit: Unit | undefined;
  let hoeveelheid = amount;

  if (eenheid) {
    unit = eenheid;
    const factor = UNIT_MULTIPLIER[woord];
    if (factor && hoeveelheid !== undefined) hoeveelheid *= factor;
  } else if (woordDeel) {
    // Geen eenheid: het woord hoort bij de naam.
    rest = `${woordDeel} ${rest}`.trim();
    if (hoeveelheid !== undefined) unit = 'stuks';
  }

  // "snufje zout" zonder getal is er één.
  if (hoeveelheid === undefined && eenheid) hoeveelheid = 1;
  if (hoeveelheid === undefined) return null;
  if (!rest.trim()) return null;

  const [naamDeel, ...notitieDelen] = rest.split(',');
  const naam = (naamDeel ?? '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (!naam) return null;

  const gevonden = library.match(naam);
  const notitie = notitieDelen.join(',').trim();

  return {
    ...(hoeveelheid !== undefined ? { amount: hoeveelheid } : {}),
    ...(unit ? { unit } : {}),
    ...(gevonden ? { ingredientId: gevonden.id } : {}),
    name: gevonden?.name ?? naam,
    ...(notitie ? { note: notitie } : {}),
  };
};

export const parseRecipeText = (tekst: string, library: IngredientLibrary): ParsedRecipe => {
  const regels = tekst.split(/\r?\n/).map((regel) => regel.trim());
  const resultaat: ParsedRecipe = {
    title: '',
    times: { prep: 0, active: 0, passive: 0 },
    ingredients: [],
    steps: [],
    leftovers: [],
  };

  let sectie: 'kop' | 'ingredienten' | 'bereiding' = 'kop';

  for (const regel of regels) {
    if (!regel) continue;

    if (KOP_INGREDIENTEN.test(regel)) {
      sectie = 'ingredienten';
      continue;
    }
    if (KOP_BEREIDING.test(regel)) {
      sectie = 'bereiding';
      continue;
    }

    const personen = PERSONEN.exec(regel);
    if (personen?.[1]) {
      resultaat.servings = Number(personen[1]);
      if (normalizeName(regel).replace(PERSONEN, '').trim().length < 3) continue;
    }

    const tijd = /(voorbereiden|voorbereidingstijd|snijden)/i.test(regel)
      ? 'prep'
      : /(wacht|rijzen|stoven|marineren|koelkast|oventijd|passief)/i.test(regel)
        ? 'passive'
        : /(bereidingstijd|kooktijd|totale tijd|klaar in|actief)/i.test(regel)
          ? 'active'
          : null;
    if (tijd) {
      const minuten = minutenIn(regel);
      if (minuten !== undefined) {
        resultaat.times[tijd] = minuten;
        continue;
      }
    }

    if (sectie === 'kop' && !resultaat.title) {
      resultaat.title = regel.replace(/^#+\s*/, '');
      continue;
    }

    if (sectie === 'bereiding') {
      const stap = regel.replace(AANHEF, '').trim();
      if (stap.length > 3) resultaat.steps.push(stap);
      continue;
    }

    const naarSmaak = leesNaarSmaak(regel, library);
    if (naarSmaak) {
      resultaat.ingredients.push(...naarSmaak);
      sectie = 'ingredienten';
      continue;
    }

    const ingredient = leesIngredient(regel, library);
    if (ingredient) {
      resultaat.ingredients.push(ingredient);
      sectie = 'ingredienten';
      continue;
    }

    // Buiten een bereidingskop is een lange zin waarschijnlijk toch een stap.
    if (sectie === 'ingredienten' && /[.!?]$/.test(regel) && regel.length > 25) {
      resultaat.steps.push(regel.replace(AANHEF, '').trim());
      continue;
    }

    resultaat.leftovers.push(regel);
  }

  if (!resultaat.title) resultaat.title = 'Naamloos recept';
  return resultaat;
};
