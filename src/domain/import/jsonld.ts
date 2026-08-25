import type { IngredientLibrary } from '../ingredients/library';
import type { ParsedRecipe } from '../text/parse';
import { convertTemperatures, ovenTempFrom } from './foreign';
import { parseImportLine } from './line';

/**
 * Receptgegevens uit de bron van een webpagina.
 *
 * Vrijwel elke receptensite zet een blok JSON-LD in de pagina volgens
 * schema.org/Recipe — dat is wat Google in de zoekresultaten laat zien, dus
 * iedereen levert het. Dat blok lezen is oneindig veel betrouwbaarder dan de
 * opmaak van de pagina proberen te ontrafelen, en het is bovendien overal
 * hetzelfde.
 *
 * De regel blijft: wat niet zeker is wordt niet geraden. Alles komt daarna
 * langs de controlestap van het formulier.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isObject = (waarde: Json | undefined): waarde is { [key: string]: Json } =>
  typeof waarde === 'object' && waarde !== null && !Array.isArray(waarde);

const SCRIPTS = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const ENTITEITEN: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  euml: 'ë',
  iuml: 'ï',
  ouml: 'ö',
  uuml: 'ü',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
};

export const decodeEntities = (tekst: string): string =>
  tekst
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z0-9#]+);/gi, (heel, naam: string) => ENTITEITEN[naam.toLowerCase()] ?? heel);

/** Van HTML naar leesbare tekst, met de regelovergangen die de opmaak bedoelde. */
export const stripHtml = (tekst: string): string =>
  decodeEntities(
    tekst
      .replace(/<\s*(?:br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[ \t]+/g, ' '),
  )
    .split('\n')
    .map((regel) => regel.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

/** Alle JSON-LD-blokken uit een pagina, ook als er een ongeldige tussen zit. */
export const extractJsonLd = (html: string): Json[] => {
  const blokken: Json[] = [];
  for (const treffer of html.matchAll(SCRIPTS)) {
    const inhoud = (treffer[1] ?? '').trim();
    if (!inhoud) continue;
    try {
      blokken.push(JSON.parse(decodeEntities(inhoud)) as Json);
    } catch {
      // Eén stukgeslagen blok mag de rest van de pagina niet meenemen.
    }
  }
  return blokken;
};

const heeftType = (knoop: { [key: string]: Json }, type: string): boolean => {
  const waarde = knoop['@type'];
  if (typeof waarde === 'string') return waarde.toLowerCase() === type;
  if (Array.isArray(waarde)) {
    return waarde.some((deel) => typeof deel === 'string' && deel.toLowerCase() === type);
  }
  return false;
};

/** Zoekt het Recipe-object, ook als het in een @graph of een lijst verstopt zit. */
export const findRecipeNode = (blokken: Json[]): { [key: string]: Json } | null => {
  const stapel: Json[] = [...blokken];
  const gezien = new Set<Json>();
  while (stapel.length > 0) {
    const knoop = stapel.shift();
    if (knoop === undefined || knoop === null || typeof knoop !== 'object') continue;
    if (gezien.has(knoop)) continue;
    gezien.add(knoop);
    if (Array.isArray(knoop)) {
      stapel.push(...knoop);
      continue;
    }
    if (heeftType(knoop, 'recipe')) return knoop;
    stapel.push(...Object.values(knoop));
  }
  return null;
};

const eersteString = (waarde: Json | undefined): string | undefined => {
  if (typeof waarde === 'string') return waarde.trim() || undefined;
  if (typeof waarde === 'number') return String(waarde);
  if (Array.isArray(waarde)) {
    for (const deel of waarde) {
      const gevonden = eersteString(deel);
      if (gevonden) return gevonden;
    }
    return undefined;
  }
  if (isObject(waarde)) return eersteString(waarde['url'] ?? waarde['name'] ?? waarde['text']);
  return undefined;
};

const stringLijst = (waarde: Json | undefined): string[] => {
  if (typeof waarde === 'string') {
    return waarde
      .split(',')
      .map((deel) => deel.trim())
      .filter(Boolean);
  }
  if (Array.isArray(waarde)) return waarde.flatMap(stringLijst);
  if (isObject(waarde)) return stringLijst(waarde['name']);
  return [];
};

/**
 * Regels die als geheel bij elkaar horen, zoals `recipeIngredient`. Anders dan
 * bij `stringLijst` wordt hier níét op komma's gesplitst: "2 uien, gesnipperd"
 * is één ingrediënt met een toelichting, geen twee ingrediënten.
 */
const regelLijst = (waarde: Json | undefined): string[] => {
  if (typeof waarde === 'string') return waarde.trim() ? [waarde.trim()] : [];
  if (Array.isArray(waarde)) return waarde.flatMap(regelLijst);
  if (isObject(waarde)) return regelLijst(waarde['text'] ?? waarde['name'] ?? null);
  return [];
};

/** ISO 8601-duur ("PT1H30M") naar minuten. Dagen tellen mee, seconden niet. */
export const isoDurationToMinutes = (waarde: Json | undefined): number | undefined => {
  const tekst = eersteString(waarde);
  if (!tekst) return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i.exec(tekst.trim());
  if (!match) return undefined;
  const [, dagen, uren, minuten] = match;
  const totaal = Number(dagen ?? 0) * 24 * 60 + Number(uren ?? 0) * 60 + Number(minuten ?? 0);
  return totaal > 0 ? totaal : undefined;
};

const PORTIEWOORDEN = /serv(?:ing|es)|portion|portie|persone?n|pers\b|people|eters/i;

/**
 * "4 servings", "Serves 4-6", ["4"] — allemaal 4.
 *
 * `recipeYield` is berucht dubbelzinnig: bij een taart staat er "24 cookies" en
 * dat zijn geen 24 porties. Het getal is nog steeds het beste dat er is, maar
 * of het écht om personen gaat blijkt alleen uit het woord ernaast. Daarom komt
 * dat er los bij terug, zodat de app het kan melden in plaats van te doen alsof.
 */
export const parseYield = (
  waarde: Json | undefined,
): { servings: number; zeker: boolean } | undefined => {
  const tekst = eersteString(waarde);
  if (!tekst) return undefined;
  const getal = /(\d+)/.exec(tekst);
  if (!getal?.[1]) return undefined;
  const aantal = Number(getal[1]);
  if (aantal < 1 || aantal > 100) return undefined;
  // Staat er alleen een getal, dan bedoelt de site vrijwel altijd porties.
  const zeker = PORTIEWOORDEN.test(tekst) || /^\s*\d+\s*$/.test(tekst);
  return { servings: aantal, zeker };
};

/**
 * De stappen. Sites schrijven ze als één lap HTML, als lijst met tekst, als
 * `HowToStep`, of als `HowToSection` met de stappen erin — soms door elkaar.
 */
export const flattenInstructions = (waarde: Json | undefined): string[] => {
  if (typeof waarde === 'string') {
    return stripHtml(waarde)
      .split('\n')
      .map((regel) => regel.replace(/^\d{1,2}[.)]\s*/, '').trim())
      .filter((regel) => regel.length > 2);
  }
  if (Array.isArray(waarde)) return waarde.flatMap(flattenInstructions);
  if (isObject(waarde)) {
    if (waarde['itemListElement']) return flattenInstructions(waarde['itemListElement']);
    return flattenInstructions(waarde['text'] ?? waarde['name'] ?? null);
  }
  return [];
};

const DIEETTAGS: Record<string, string> = {
  vegetariandiet: 'vegetarisch',
  vegandiet: 'vegan',
  glutenfreediet: 'glutenvrij',
  lowlactosediet: 'lactosevrij',
};

const schoneTags = (knoop: { [key: string]: Json }): string[] => {
  const ruw = [
    ...stringLijst(knoop['keywords']),
    ...stringLijst(knoop['recipeCategory']),
    ...stringLijst(knoop['recipeCuisine']),
  ];
  const dieet = stringLijst(knoop['suitableForDiet'])
    .map((waarde) => DIEETTAGS[waarde.split('/').pop()?.toLowerCase() ?? ''] ?? '')
    .filter(Boolean);

  const uniek = new Set<string>(dieet);
  for (const tag of ruw) {
    const schoon = tag.toLowerCase().trim();
    if (schoon.length >= 3 && schoon.length <= 30 && !schoon.includes('http')) uniek.add(schoon);
  }
  return [...uniek].slice(0, 8);
};

export interface ImportOptions {
  /** De URL waar de pagina vandaan kwam; die wordt de bron van het recept. */
  url: string;
  library: IngredientLibrary;
}

/**
 * Van de bron van een pagina naar een recept dat het formulier kan vullen.
 * Vindt hij geen JSON-LD, dan komt er `null` terug: dan is deze route niet de
 * juiste en kan de app dat gewoon zeggen.
 */
export const importFromHtml = (html: string, options: ImportOptions): ParsedRecipe | null => {
  const knoop = findRecipeNode(extractJsonLd(html));
  if (!knoop) return null;

  const warnings: string[] = [];
  const leftovers: string[] = [];

  const ingredients = [];
  for (const regel of regelLijst(knoop['recipeIngredient'])) {
    const gelezen = parseImportLine(stripHtml(regel), options.library);
    if (gelezen) ingredients.push(gelezen);
    else leftovers.push(regel);
  }

  const stappen = flattenInstructions(knoop['recipeInstructions']).map(convertTemperatures);
  const ovenTemps = stappen.map(ovenTempFrom);

  const prep = isoDurationToMinutes(knoop['prepTime']) ?? 0;
  const cook = isoDurationToMinutes(knoop['cookTime']) ?? 0;
  const totaal = isoDurationToMinutes(knoop['totalTime']);
  // Zonder aparte kooktijd is alles wat na het voorbereiden overblijft actief;
  // staat er wél een kooktijd, dan is het verschil met de totale tijd wachten:
  // rijzen, marineren, laten afkoelen. Dat onderscheid is het belangrijkste
  // veld van dit model, dus het zou zonde zijn die informatie weg te gooien.
  const active = cook > 0 ? cook : totaal !== undefined ? Math.max(0, totaal - prep) : 0;
  const passive = totaal !== undefined ? Math.max(0, totaal - prep - active) : 0;

  const opbrengst = parseYield(knoop['recipeYield']);
  const ruweOpbrengst = eersteString(knoop['recipeYield']);

  if (ingredients.length === 0) warnings.push('Er zijn geen ingrediënten gevonden op deze pagina.');
  if (stappen.length === 0) warnings.push('Er zijn geen stappen gevonden op deze pagina.');
  if (opbrengst && !opbrengst.zeker && ruweOpbrengst) {
    warnings.push(
      `Op de pagina staat "${ruweOpbrengst}". Dat is als ${opbrengst.servings} personen overgenomen; kijk even of dat klopt.`,
    );
  }
  const ongekoppeld = ingredients.filter((regel) => !regel.ingredientId).length;
  if (ongekoppeld > 0) {
    warnings.push(
      `${ongekoppeld} ${ongekoppeld === 1 ? 'ingrediënt staat' : 'ingrediënten staan'} nog niet in de bibliotheek.`,
    );
  }

  const titel = eersteString(knoop['name']) ?? 'Naamloos recept';
  const beschrijving = eersteString(knoop['description']);
  const auteur = eersteString(
    isObject(knoop['author']) ? knoop['author']['name'] : knoop['author'],
  );

  return {
    title: stripHtml(titel),
    ...(beschrijving ? { description: stripHtml(beschrijving) } : {}),
    ...(opbrengst ? { servings: opbrengst.servings } : {}),
    times: { prep, active, passive },
    ingredients,
    steps: stappen,
    ovenTemps,
    tags: schoneTags(knoop),
    ...(eersteString(knoop['image']) ? { image: eersteString(knoop['image']) } : {}),
    source: { type: 'url', url: options.url, ...(auteur ? { title: auteur } : {}) },
    leftovers,
    warnings,
  };
};
