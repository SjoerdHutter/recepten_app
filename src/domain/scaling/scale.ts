import type { Ingredient } from '../schema/ingredient';
import type { Recipe, RecipeIngredient } from '../schema/recipe';
import type { IngredientLibrary } from '../ingredients/library';
import { roundInUnit } from '../units/round';
import type { Unit } from '../units/units';

export interface ScaledIngredient {
  line: RecipeIngredient;
  ingredient: Ingredient | undefined;
  /** Naam zoals getoond, met meervoud waar dat kan. */
  label: string;
  /** Praktisch afgeronde hoeveelheid, dit staat op het scherm. */
  amount: number;
  /** Onafgerond, hiermee rekent de boodschappenlijst verder. */
  exactAmount: number;
  unit: Unit;
  /** Onwaar als de regel bewust niet meeschaalt. */
  scaled: boolean;
}

export const scaleFactor = (recipe: Recipe, servings: number): number =>
  servings > 0 && recipe.servings > 0 ? servings / recipe.servings : 1;

/**
 * Schaalt de ingrediënten naar een ander aantal personen. Afronden gebeurt in
 * de eenheid waarin het recept het opschreef, en pas ná de vermenigvuldiging,
 * zodat er geen afrondingsfouten opstapelen.
 */
export const scaleRecipe = (
  recipe: Recipe,
  servings: number,
  library: IngredientLibrary,
): ScaledIngredient[] => {
  const factor = scaleFactor(recipe, servings);
  return recipe.ingredients.map((line) => {
    const meeschalen = line.scales && factor !== 1;
    const exactAmount = meeschalen ? line.amount * factor : line.amount;
    const ingredient = library.get(line.ingredientId);
    const amount = meeschalen ? roundInUnit(exactAmount, line.unit) : line.amount;
    return {
      line,
      ingredient,
      label: library.label(line.ingredientId, line.name, amount !== 1),
      amount,
      exactAmount,
      unit: line.unit,
      scaled: meeschalen,
    };
  });
};

/** De stappen mogen dezelfde hoeveelheden tonen als de ingrediëntenlijst. */
export const ingredientsForStep = (
  scaled: ScaledIngredient[],
  stepNumber: number,
): ScaledIngredient[] => scaled.filter((item) => item.line.step === stepNumber);
