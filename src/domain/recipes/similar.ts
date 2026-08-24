import { normalizeName } from '../ingredients/library';
import type { Recipe } from '../schema/recipe';

/**
 * Voorkomt dat hetzelfde gerecht er twee keer in belandt, bijvoorbeeld omdat je
 * het een keer "Pasta pesto" en een keer "Pesto pasta" noemde. De vergelijking
 * kijkt naar de titel én naar de ingrediëntenset; alleen op de titel afgaan
 * levert te veel valse alarmen op.
 */

/** Woorden die niets zeggen over wát het gerecht is. */
const STOPWOORDEN = new Set([
  'met',
  'en',
  'van',
  'de',
  'het',
  'een',
  'uit',
  'in',
  'op',
  'voor',
  'bij',
  'zonder',
  'aan',
  'oven',
  'pan',
]);

const woorden = (tekst: string): Set<string> =>
  new Set(
    normalizeName(tekst)
      .split(' ')
      .filter((woord) => woord.length > 2 && !STOPWOORDEN.has(woord)),
  );

/** Overlap tussen twee verzamelingen, 0 tot 1. */
const dice = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let gedeeld = 0;
  for (const waarde of a) if (b.has(waarde)) gedeeld += 1;
  return (2 * gedeeld) / (a.size + b.size);
};

export interface SimilarCandidate {
  id: string;
  title: string;
  ingredientIds: string[];
}

export interface SimilarMatch {
  recipe: Recipe;
  score: number;
  /** Waarom de app denkt dat het hetzelfde gerecht is. */
  reason: string;
}

export const recipeIngredientIdSet = (recipe: Recipe): string[] =>
  recipe.ingredients
    .map((line) => line.ingredientId ?? normalizeName(line.name ?? ''))
    .filter(Boolean);

/** Boven deze score wordt er gewaarschuwd. */
export const SIMILARITY_THRESHOLD = 0.55;

export const findSimilarRecipes = (
  kandidaat: SimilarCandidate,
  recipes: Recipe[],
  drempel = SIMILARITY_THRESHOLD,
): SimilarMatch[] => {
  const titelWoorden = woorden(kandidaat.title);
  const ingredienten = new Set(kandidaat.ingredientIds);

  return recipes
    .filter((recipe) => recipe.id !== kandidaat.id)
    .map((recipe) => {
      const titel = dice(titelWoorden, woorden(recipe.title));
      const set = dice(ingredienten, new Set(recipeIngredientIdSet(recipe)));
      const score = 0.55 * titel + 0.45 * set;
      const reason =
        titel >= 0.6 && set >= 0.5
          ? 'bijna dezelfde titel en vrijwel dezelfde ingrediënten'
          : titel >= 0.6
            ? 'bijna dezelfde titel'
            : 'vrijwel dezelfde ingrediënten';
      return { recipe, score, reason };
    })
    .filter((match) => match.score >= drempel)
    .sort((a, b) => b.score - a.score);
};
