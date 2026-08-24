import type { Ingredient } from '../schema/ingredient';
import type { Recipe } from '../schema/recipe';
import { createLibrary, normalizeName } from './library';
import type { LibraryState } from './edits';

/**
 * Zoekt op wat er in de bibliotheek scheef is gaan lopen. Dit is het sluitstuk
 * van de keuze om de CI niet te laten falen op een losse ingrediëntnaam: wat er
 * met de hand op github.com bij komt mag blijven staan, maar het komt hier wel
 * op een lijst te staan in plaats van dat het stil verdwijnt.
 */

export interface UnlinkedLine {
  recipeId: string;
  recipeTitle: string;
  lineIndex: number;
  name: string;
  /** Wat de bibliotheek zelf denkt dat het is; vaak meteen goed. */
  suggestion: Ingredient | undefined;
}

export interface MissingReference {
  recipeId: string;
  recipeTitle: string;
  lineIndex: number;
  ingredientId: string;
}

export interface DuplicatePair {
  a: Ingredient;
  b: Ingredient;
  reason: 'zelfde naam' | 'gedeeld synoniem' | 'lijkt sterk op elkaar';
  score: number;
}

export interface LibraryReport {
  unlinked: UnlinkedLine[];
  missing: MissingReference[];
  orphans: Ingredient[];
  duplicates: DuplicatePair[];
  usage: Map<string, number>;
  total: number;
}

/** Overeenkomst tussen twee woorden op basis van letterparen, 0 tot 1. */
const bigrams = (waarde: string): Set<string> => {
  const schoon = normalizeName(waarde).replace(/\s/g, '');
  const uit = new Set<string>();
  for (let i = 0; i < schoon.length - 1; i++) uit.add(schoon.slice(i, i + 2));
  return uit;
};

export const nameSimilarity = (a: string, b: string): number => {
  const links = bigrams(a);
  const rechts = bigrams(b);
  if (links.size === 0 || rechts.size === 0) return normalizeName(a) === normalizeName(b) ? 1 : 0;
  let gedeeld = 0;
  for (const paar of links) if (rechts.has(paar)) gedeeld += 1;
  return (2 * gedeeld) / (links.size + rechts.size);
};

/** Vanaf hier lijken twee namen genoeg op elkaar om het te melden. */
const GELIJKENIS_DREMPEL = 0.82;

/**
 * In het Nederlands maak je van een ingrediënt een ánder product door er een
 * woord achter te plakken: sinaasappel wordt sinaasappelsap, witte wijn wordt
 * witte wijnazijn. Op letterparen lijken die bijna identiek, terwijl je ze nooit
 * wilt samenvoegen. Een meervoud voegt hooguit een letter of twee toe
 * (courgette/courgettes), dus daar zit de grens.
 */
const isAnderProduct = (a: string, b: string): boolean => {
  const links = normalizeName(a).replace(/\s/g, '');
  const rechts = normalizeName(b).replace(/\s/g, '');
  const [kort, lang] = links.length <= rechts.length ? [links, rechts] : [rechts, links];
  return lang.startsWith(kort) && lang.length - kort.length > 2;
};

export const analyseLibrary = (state: LibraryState): LibraryReport => {
  const { ingredients, recipes } = state;
  const library = createLibrary(ingredients);
  const bekend = new Map(ingredients.map((item) => [item.id, item]));

  const unlinked: UnlinkedLine[] = [];
  const missing: MissingReference[] = [];
  const usage = new Map<string, number>();

  for (const recipe of recipes) {
    recipe.ingredients.forEach((line, lineIndex) => {
      if (line.ingredientId) {
        if (!bekend.has(line.ingredientId)) {
          missing.push({
            recipeId: recipe.id,
            recipeTitle: recipe.title,
            lineIndex,
            ingredientId: line.ingredientId,
          });
          return;
        }
        usage.set(line.ingredientId, (usage.get(line.ingredientId) ?? 0) + 1);
        return;
      }
      const naam = line.name ?? '';
      if (!naam.trim()) return;
      unlinked.push({
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        lineIndex,
        name: naam,
        suggestion: library.match(naam),
      });
    });
  }

  const orphans = ingredients
    .filter((item) => (usage.get(item.id) ?? 0) === 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  // Dubbelingen: eerst de harde botsingen, daarna wat er alleen op lijkt.
  const duplicates: DuplicatePair[] = [];
  const gezienPaar = new Set<string>();
  const paarSleutel = (a: Ingredient, b: Ingredient) => [a.id, b.id].sort().join('|');

  // Alle namen waaronder een ingrediënt bekend staat in één register. Zo wordt
  // ook de lastigste dubbeling gevonden: een náám die al als synoniem van iets
  // anders bestond. Precies wat er gebeurt als je "gele ui" invoert terwijl dat
  // al een synoniem van "ui" is.
  const opAlias = new Map<string, Ingredient[]>();
  for (const item of ingredients) {
    const aliassen = new Set(
      [item.name, item.plural, item.nameEn, ...item.synonyms]
        .filter((naam): naam is string => Boolean(naam))
        .map(normalizeName)
        .filter(Boolean),
    );
    for (const alias of aliassen) {
      opAlias.set(alias, [...(opAlias.get(alias) ?? []), item]);
    }
  }

  for (const groep of opAlias.values()) {
    if (groep.length < 2) continue;
    for (let i = 0; i < groep.length; i++) {
      for (let j = i + 1; j < groep.length; j++) {
        const a = groep[i];
        const b = groep[j];
        if (!a || !b) continue;
        const sleutel = paarSleutel(a, b);
        if (gezienPaar.has(sleutel)) continue;
        gezienPaar.add(sleutel);
        duplicates.push({
          a,
          b,
          reason:
            normalizeName(a.name) === normalizeName(b.name) ? 'zelfde naam' : 'gedeeld synoniem',
          score: 1,
        });
      }
    }
  }

  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      const a = ingredients[i];
      const b = ingredients[j];
      if (!a || !b) continue;
      const sleutel = paarSleutel(a, b);
      if (gezienPaar.has(sleutel)) continue;
      const score = nameSimilarity(a.name, b.name);
      if (score < GELIJKENIS_DREMPEL) continue;
      if (isAnderProduct(a.name, b.name)) continue;
      gezienPaar.add(sleutel);
      duplicates.push({ a, b, reason: 'lijkt sterk op elkaar', score });
    }
  }

  duplicates.sort((links, rechts) => rechts.score - links.score);

  return {
    unlinked,
    missing,
    orphans,
    duplicates,
    usage,
    total: unlinked.length + missing.length + orphans.length + duplicates.length,
  };
};

/** Ingrediënten die nergens gebruikt worden én nergens naar verwijzen. */
export const isOrphan = (report: LibraryReport, id: string): boolean =>
  (report.usage.get(id) ?? 0) === 0;

export type { Ingredient, Recipe };
