import type { IngredientLibrary } from '../ingredients/library';
import type { Recipe, RecipeIngredient } from '../schema/recipe';
import { convertToBase } from '../units/convert';
import { dimensionOf } from '../units/units';
import { pantryIndex, type Pantry } from './pantry';

/**
 * "Wat kan ik nu maken": recepten gerangschikt op hoeveel je nog mist.
 *
 * Twee soorten regels tellen bewust niet mee als ontbrekend:
 * - optionele ingrediënten, want die maken het gerecht niet onmogelijk;
 * - "naar smaak" (peper, zout, kruiden), want anders zou elk recept eeuwig
 *   melden dat je zout mist en zou de ranglijst niets meer zeggen.
 * Ze worden wel apart geteld, zodat je ze nog ziet staan.
 */

export interface MissingItem {
  label: string;
  ingredientId: string | undefined;
  /** Waar staat: je hebt het wel, maar te weinig. */
  tooLittle: boolean;
}

export interface Cookability {
  recipe: Recipe;
  missing: MissingItem[];
  /** Aantal verplichte ingrediënten dat je wél hebt. */
  haveCount: number;
  requiredCount: number;
  missingOptional: number;
  /** Peper, zout en kruiden die je niet aangevinkt hebt. */
  toTaste: number;
}

const labelVoor = (
  line: RecipeIngredient,
  library: IngredientLibrary,
): { id: string | undefined; label: string } => {
  if (line.ingredientId) {
    return { id: line.ingredientId, label: library.label(line.ingredientId, line.ingredientId) };
  }
  // Een regel met alleen een vrije naam: kijken of de bibliotheek hem herkent.
  const treffer = line.name ? library.match(line.name) : undefined;
  return { id: treffer?.id, label: treffer?.name ?? line.name ?? 'onbekend' };
};

export const assessRecipe = (
  recipe: Recipe,
  pantry: Pantry,
  library: IngredientLibrary,
): Cookability => {
  const index = pantryIndex(pantry);
  const missing: MissingItem[] = [];
  let haveCount = 0;
  let requiredCount = 0;
  let missingOptional = 0;
  let toTaste = 0;

  for (const line of recipe.ingredients) {
    const { id, label } = labelVoor(line, library);
    const item = id ? index.get(id) : undefined;
    const inHuis = Boolean(item);

    if (line.optional) {
      if (!inHuis) missingOptional += 1;
      continue;
    }
    if (line.scales === 'taste') {
      if (!inHuis) toTaste += 1;
      continue;
    }

    requiredCount += 1;

    if (!item) {
      missing.push({ label, ingredientId: id, tooLittle: false });
      continue;
    }

    // Staat er een hoeveelheid in de voorraadkast én vraagt het recept er een,
    // dan telt te weinig hebben ook als missen.
    if (item.amount !== undefined && item.unit && line.amount !== undefined && line.unit) {
      const ingredient = library.get(id);
      const dimensie = dimensionOf(line.unit);
      const nodig = convertToBase(line.amount, line.unit, dimensie, ingredient);
      const aanwezig = convertToBase(item.amount, item.unit, dimensie, ingredient);
      if (nodig !== null && aanwezig !== null && aanwezig < nodig) {
        missing.push({ label, ingredientId: id, tooLittle: true });
        continue;
      }
    }

    haveCount += 1;
  }

  return { recipe, missing, haveCount, requiredCount, missingOptional, toTaste };
};

/**
 * Alles op een rij, het minst ontbrekende eerst. Bij gelijk aantal missers wint
 * het recept dat meer van je voorraad gebruikt: dat ruimt je kast het beste op.
 */
export const rankByPantry = (
  recipes: Recipe[],
  pantry: Pantry,
  library: IngredientLibrary,
): Cookability[] =>
  recipes
    .map((recipe) => assessRecipe(recipe, pantry, library))
    .sort(
      (a, b) =>
        a.missing.length - b.missing.length ||
        b.haveCount - a.haveCount ||
        a.recipe.title.localeCompare(b.recipe.title, 'nl'),
    );
