import type { IngredientLibrary } from '../ingredients/library';
import type { Ingredient, Nutrition } from '../schema/ingredient';
import type { Recipe } from '../schema/recipe';
import { scaleRecipe } from '../scaling/scale';
import { convertToBase } from '../units/convert';
import { dimensionOf, type Quantity } from '../units/units';

/**
 * Voedingswaarde per portie, opgeteld uit de bibliotheek.
 *
 * Dit is een indicatie en geen voedingsadvies, en de app zegt dat ook. Twee
 * dingen maken het onvermijdelijk onnauwkeurig: de waarden per 100 g zijn
 * richtgetallen voor een gemiddeld product, en niet elk ingrediënt heeft ze.
 * Daarom telt deze berekening altijd bij hoeveel gram er meegerekend is en
 * hoeveel niet — een getal zonder die dekking is misleidend.
 */

export interface NutritionTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  salt: number;
}

export const leegTotaal = (): NutritionTotals => ({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  salt: 0,
});

export interface NutritionSummary {
  /** Voor het hele gerecht. */
  total: NutritionTotals;
  /** Per portie. */
  perServing: NutritionTotals;
  /** Aantal ingrediëntregels waarvoor gegevens bestonden. */
  known: number;
  /** Regels waarvan het gewicht bekend was maar de voedingswaarde niet. */
  unknown: number;
  /**
   * Regels die niet te wegen vielen, zoals een bosje peterselie of "naar
   * smaak". Die drukken de dekking niet, want er valt niets te missen wat je
   * had kunnen meten — maar ze horen wel apart genoemd te worden.
   */
  unweighable: number;
  /** Hoeveel gram er meegerekend is, en hoeveel er buiten viel. */
  gramsCounted: number;
  gramsMissing: number;
  /** Regels waarbij milliliter als gram is gelezen omdat de dichtheid ontbrak. */
  assumedDensity: number;
  /** De oudste peildatum die meetelt. */
  oldestDate: string | undefined;
  /** Waar de gegevens vandaan komen, ontdubbeld. */
  sources: string[];
}

/**
 * Hoeveel gram is dit? Massa rekent rechtstreeks; bij volume is een dichtheid
 * nodig. Staat die niet in de bibliotheek, dan wordt 1 g per ml aangenomen —
 * dat klopt voor water en bouillon, en zit er bij olie zo'n 8% naast. Zulke
 * regels worden apart geteld zodat de app het kan melden.
 */
export const gramsOf = (
  quantity: Quantity,
  ingredient: Ingredient | undefined,
): { grams: number; assumed: boolean } | null => {
  const directe = convertToBase(quantity.amount, quantity.unit, 'massa', ingredient);
  if (directe !== null) return { grams: directe, assumed: false };

  if (dimensionOf(quantity.unit) === 'volume') {
    // Eerst naar milliliter, dán pas de dichtheid toepassen. De omrekeningen in
    // de bibliotheek staan op de bróneenheid, dus een factor "1 ml is 0,92 g"
    // helpt niet rechtstreeks bij een hoeveelheid in eetlepels; via ml wel.
    const ml = convertToBase(quantity.amount, quantity.unit, 'volume', ingredient);
    if (ml === null) return null;
    const dichtheid = ingredient?.conversions?.ml?.g;
    return dichtheid ? { grams: ml * dichtheid, assumed: false } : { grams: ml, assumed: true };
  }
  return null;
};

const optellen = (totaal: NutritionTotals, per100: Nutrition, grams: number): NutritionTotals => {
  const factor = grams / 100;
  return {
    kcal: totaal.kcal + per100.kcal * factor,
    protein: totaal.protein + per100.protein * factor,
    carbs: totaal.carbs + per100.carbs * factor,
    fat: totaal.fat + per100.fat * factor,
    fiber: totaal.fiber + (per100.fiber ?? 0) * factor,
    salt: totaal.salt + (per100.salt ?? 0) * factor,
  };
};

const delen = (totaal: NutritionTotals, deler: number): NutritionTotals =>
  deler > 0
    ? {
        kcal: totaal.kcal / deler,
        protein: totaal.protein / deler,
        carbs: totaal.carbs / deler,
        fat: totaal.fat / deler,
        fiber: totaal.fiber / deler,
        salt: totaal.salt / deler,
      }
    : totaal;

export const recipeNutrition = (
  recipe: Recipe,
  library: IngredientLibrary,
  servings = recipe.servings,
): NutritionSummary => {
  const geschaald = scaleRecipe(recipe, servings, library);

  let total = leegTotaal();
  let known = 0;
  let unknown = 0;
  let unweighable = 0;
  let gramsCounted = 0;
  let gramsMissing = 0;
  let assumedDensity = 0;
  let oldestDate: string | undefined;
  const sources = new Set<string>();

  for (const item of geschaald) {
    if (item.amount === undefined || item.unit === undefined) continue;
    const gram = gramsOf({ amount: item.amount, unit: item.unit }, item.ingredient);
    const waarden = item.ingredient?.nutrition;

    if (!gram) {
      unweighable += 1;
      continue;
    }
    if (!waarden) {
      unknown += 1;
      gramsMissing += gram.grams;
      continue;
    }

    total = optellen(total, waarden, gram.grams);
    known += 1;
    gramsCounted += gram.grams;
    if (gram.assumed) assumedDensity += 1;
    if (waarden.source) sources.add(waarden.source);
    const datum = waarden.date?.slice(0, 10);
    if (datum && (oldestDate === undefined || datum < oldestDate)) oldestDate = datum;
  }

  return {
    total,
    perServing: delen(total, servings),
    known,
    unknown,
    unweighable,
    gramsCounted,
    gramsMissing,
    assumedDensity,
    oldestDate,
    sources: [...sources],
  };
};

/**
 * Hoe compleet is de berekening, uitgedrukt in het aandeel gram waarvoor
 * gegevens bestonden. Onder de 80% zegt het getal weinig.
 */
export const coverage = (samenvatting: NutritionSummary): number => {
  const totaal = samenvatting.gramsCounted + samenvatting.gramsMissing;
  return totaal > 0 ? samenvatting.gramsCounted / totaal : 0;
};

export const BETROUWBAAR_VANAF = 0.8;

export interface NutritionFilter {
  /** Hoogstens zoveel kilocalorieën per portie. */
  maxKcal: number | null;
  /** Minstens zoveel gram eiwit per portie. */
  minProtein: number | null;
}

export const EMPTY_NUTRITION_FILTER: NutritionFilter = { maxKcal: null, minProtein: null };

export const hasNutritionFilter = (filter: NutritionFilter): boolean =>
  filter.maxKcal !== null || filter.minProtein !== null;

/**
 * Recepten waarvan de voedingswaarde te onbetrouwbaar is vallen buiten het
 * filter in plaats van dat ze geraden worden: liever een recept missen dan een
 * verkeerd getal presenteren als grens.
 */
export const matchesNutrition = (
  recipe: Recipe,
  filter: NutritionFilter,
  library: IngredientLibrary,
): boolean => {
  if (!hasNutritionFilter(filter)) return true;
  const samenvatting = recipeNutrition(recipe, library);
  if (coverage(samenvatting) < BETROUWBAAR_VANAF) return false;
  if (filter.maxKcal !== null && samenvatting.perServing.kcal > filter.maxKcal) return false;
  if (filter.minProtein !== null && samenvatting.perServing.protein < filter.minProtein) {
    return false;
  }
  return true;
};
