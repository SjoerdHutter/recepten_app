import type { IngredientLibrary } from '../ingredients/library';
import type { Ingredient } from '../schema/ingredient';
import type { Recipe } from '../schema/recipe';
import { scaleRecipe } from '../scaling/scale';
import type { ShoppingGroup } from '../shopping/aggregate';
import { convertToBase } from '../units/convert';
import { dimensionOf, type Quantity } from '../units/units';

/**
 * Geschatte kosten, op basis van de richtprijzen in de bibliotheek.
 *
 * Nadruk op geschat. De prijzen zijn met de hand ingevoerde richtbedragen met
 * een peildatum, geen live gegevens van een supermarkt. De app toont daarom
 * altijd hoeveel regels een prijs hadden en hoe oud de oudste prijs is: een
 * bedrag zonder die context suggereert een nauwkeurigheid die er niet is.
 */

export interface LineCost {
  amount: number;
  /** Peildatum van de gebruikte prijs. */
  date: string;
}

export const costOf = (quantity: Quantity, ingredient: Ingredient | undefined): LineCost | null => {
  const prijs = ingredient?.price;
  if (!prijs) return null;

  const dimensie = dimensionOf(prijs.per);
  const perEenheid = convertToBase(1, prijs.per, dimensie, ingredient);
  const nodig = convertToBase(quantity.amount, quantity.unit, dimensie, ingredient);
  if (perEenheid === null || nodig === null || perEenheid <= 0) return null;

  return { amount: (nodig / perEenheid) * prijs.amount, date: prijs.date };
};

export interface CostSummary {
  total: number;
  /** Aantal regels waarvoor een prijs bekend was. */
  known: number;
  /** Aantal regels zonder prijs; die zitten niet in het totaal. */
  unknown: number;
  /** De oudste peildatum die meegerekend is. */
  oldestDate: string | undefined;
}

const leeg: CostSummary = { total: 0, known: 0, unknown: 0, oldestDate: undefined };

export const summarize = (
  posten: Array<{ quantity: Quantity | null; ingredient: Ingredient | undefined }>,
): CostSummary =>
  posten.reduce<CostSummary>((som, post) => {
    if (!post.quantity) return som;
    const kosten = costOf(post.quantity, post.ingredient);
    if (!kosten) return { ...som, unknown: som.unknown + 1 };
    return {
      total: som.total + kosten.amount,
      known: som.known + 1,
      unknown: som.unknown,
      oldestDate:
        som.oldestDate === undefined || kosten.date < som.oldestDate ? kosten.date : som.oldestDate,
    };
  }, leeg);

/** Wat de hele boodschappenlijst ongeveer kost. */
export const listCost = (groups: ShoppingGroup[], library: IngredientLibrary): CostSummary =>
  summarize(
    groups.flatMap((groep) =>
      groep.lines.map((regel) => ({
        quantity: regel.quantity,
        ingredient: library.get(regel.ingredientId),
      })),
    ),
  );

export interface RecipeCost extends CostSummary {
  perServing: number;
}

/** Wat een recept ongeveer kost, en wat dat per portie betekent. */
export const recipeCost = (
  recipe: Recipe,
  library: IngredientLibrary,
  servings = recipe.servings,
): RecipeCost => {
  const geschaald = scaleRecipe(recipe, servings, library);
  const samenvatting = summarize(
    geschaald.map((item) => ({
      quantity:
        item.amount !== undefined && item.unit !== undefined
          ? { amount: item.amount, unit: item.unit }
          : null,
      ingredient: item.ingredient,
    })),
  );
  return { ...samenvatting, perServing: servings > 0 ? samenvatting.total / servings : 0 };
};

/** Hoe oud is de oudste prijs die meegerekend is, in dagen? */
export const priceAgeInDays = (oldestDate: string | undefined, today: Date): number | undefined => {
  if (!oldestDate) return undefined;
  const peil = new Date(`${oldestDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(peil.getTime())) return undefined;
  // Van datum tot datum tellen, niet van tijdstip tot tijdstip: anders telt een
  // halve dag mee en is een prijs van vanmorgen ineens "1 dag oud".
  const vandaag = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((vandaag.getTime() - peil.getTime()) / 86_400_000));
};
