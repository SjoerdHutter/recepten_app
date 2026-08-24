import type { IngredientLibrary } from '../ingredients/library';
import type { Recipe } from '../schema/recipe';
import { convertToBase } from '../units/convert';
import type { Quantity } from '../units/units';

/**
 * Restjesmodus: welk recept gebruikt die halve kool echt op?
 *
 * Elk recept dat kool bevat is geen antwoord — in een currysaus zit twee eetlepel
 * kool en die ligt morgen nog in de koelkast. Daarom wordt gekeken naar het
 * aandeel: hoeveel van het totale gewicht van het gerecht is dit ingrediënt?
 * Alles wordt daarvoor naar gram gerekend met de omrekenfactoren uit de
 * bibliotheek; wat niet te rekenen valt (een snufje, een bosje) telt niet mee in
 * het totaal, want anders zou een recept met veel kruiden kunstmatig zakken.
 */

export interface LeftoverMatch {
  recipe: Recipe;
  /** Aandeel van het totale gewicht, 0 tot 1. */
  share: number;
  /** Hoeveel er van dit ingrediënt in gaat, zoals het recept het opschreef. */
  quantity: Quantity | null;
}

/** Vanaf hier speelt een ingrediënt een hoofdrol in plaats van een bijrol. */
export const HOOFDROL_DREMPEL = 0.15;

export const rankByIngredient = (
  recipes: Recipe[],
  ingredientId: string,
  library: IngredientLibrary,
): LeftoverMatch[] => {
  const treffers: LeftoverMatch[] = [];

  for (const recipe of recipes) {
    let totaal = 0;
    let vanDitIngredient = 0;
    let quantity: Quantity | null = null;

    for (const line of recipe.ingredients) {
      if (line.amount === undefined || line.unit === undefined) continue;
      const ingredient = library.get(line.ingredientId);
      const gram = convertToBase(line.amount, line.unit, 'massa', ingredient);
      if (gram === null) continue;
      totaal += gram;
      if (line.ingredientId === ingredientId) {
        vanDitIngredient += gram;
        quantity = { amount: line.amount, unit: line.unit };
      }
    }

    if (vanDitIngredient === 0) continue;
    treffers.push({ recipe, share: totaal > 0 ? vanDitIngredient / totaal : 0, quantity });
  }

  return treffers.sort(
    (a, b) => b.share - a.share || a.recipe.title.localeCompare(b.recipe.title, 'nl'),
  );
};

/** Alleen de recepten waarin het ingrediënt echt een hoofdrol speelt. */
export const leadingRoleOnly = (matches: LeftoverMatch[]): LeftoverMatch[] =>
  matches.filter((match) => match.share >= HOOFDROL_DREMPEL);
