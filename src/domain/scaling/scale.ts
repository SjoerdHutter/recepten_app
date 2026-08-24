import type { Ingredient } from '../schema/ingredient';
import type { Recipe, RecipeIngredient, Scaling } from '../schema/recipe';
import type { IngredientLibrary } from '../ingredients/library';
import { roundInUnit } from '../units/round';
import type { Unit } from '../units/units';

export interface ScaledIngredient {
  line: RecipeIngredient;
  ingredient: Ingredient | undefined;
  /** Naam zoals getoond, met meervoud waar dat kan. */
  label: string;
  /** Praktisch afgeronde hoeveelheid; ontbreekt bij "naar smaak". */
  amount: number | undefined;
  /** Onafgerond, hiermee rekent de boodschappenlijst verder. */
  exactAmount: number | undefined;
  unit: Unit | undefined;
  /** Onwaar als de regel bewust niet meeschaalt. */
  scaled: boolean;
}

/**
 * Kruiden schalen met de wortel van de factor. Twee keer zoveel curry heeft
 * geen twee keer zoveel chili nodig; dat wordt niet te eten.
 */
export const scalingFactorFor = (scales: Scaling, factor: number): number => {
  if (scales === 'fixed') return 1;
  if (scales === 'taste') return Math.sqrt(factor);
  return factor;
};

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
    const eigenFactor = scalingFactorFor(line.scales, factor);
    const meeschalen = eigenFactor !== 1;
    const ingredient = library.get(line.ingredientId);
    const exactAmount = line.amount === undefined ? undefined : line.amount * eigenFactor;
    const amount =
      line.amount === undefined || line.unit === undefined
        ? undefined
        : meeschalen
          ? roundInUnit(line.amount * eigenFactor, line.unit)
          : line.amount;
    return {
      line,
      ingredient,
      label: library.label(line.ingredientId, line.name, amount !== undefined && amount !== 1),
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
