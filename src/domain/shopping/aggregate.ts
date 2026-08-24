import type { Category } from '../schema/enums';
import { CATEGORIES, CATEGORY_LABELS } from '../schema/enums';
import type { Recipe } from '../schema/recipe';
import type { IngredientLibrary } from '../ingredients/library';
import { normalizeName } from '../ingredients/library';
import { scaleRecipe } from '../scaling/scale';
import { convertToBase } from '../units/convert';
import { roundInUnit } from '../units/round';
import {
  aggregationKey,
  dimensionOf,
  fromBase,
  type Dimension,
  type Quantity,
  type Unit,
} from '../units/units';

export interface ShoppingSelection {
  recipe: Recipe;
  servings: number;
}

/** Een los item dat niets met een recept te maken heeft. */
export interface ManualItem {
  id: string;
  text: string;
  category: Category;
}

export interface ShoppingSource {
  recipeId: string;
  title: string;
  quantity: Quantity;
  optional: boolean;
}

export interface ShoppingLine {
  /** Stabiel over herberekeningen heen, zodat een vinkje blijft staan. */
  key: string;
  ingredientId?: string;
  label: string;
  category: Category;
  quantity: Quantity | null;
  /** Alleen optioneel als geen enkel recept het ingrediënt echt nodig heeft. */
  optional: boolean;
  sources: ShoppingSource[];
  manual: boolean;
  /**
   * Wat je hiervan al in huis hebt. Wordt pas ingevuld door applyPantry, zodat
   * het optellen zelf niets van de voorraadkast hoeft te weten.
   */
  stock?: import('../pantry/subtract').StockInfo;
}

export interface ShoppingGroup {
  category: Category;
  label: string;
  lines: ShoppingLine[];
}

interface Contribution {
  recipeId: string;
  title: string;
  amount: number;
  unit: Unit;
  optional: boolean;
}

/**
 * Welke dimensie wordt de gemene deler binnen één ingrediënt? Omrekenfactoren
 * lopen van een aantal naar een gewicht ("1 ui is 150 g"), dus massa en volume
 * winnen het van tellen.
 */
const chooseTarget = (contributions: Contribution[]): Dimension | null => {
  const dims = new Set(contributions.map((c) => dimensionOf(c.unit)));
  if (dims.size === 0) return null;
  if (dims.has('massa') && dims.size > 1) return 'massa';
  if (dims.has('volume') && dims.size > 1) return 'volume';
  const eerste = [...dims][0];
  return eerste ?? null;
};

export const buildShoppingList = (
  selections: ShoppingSelection[],
  library: IngredientLibrary,
  manualItems: ManualItem[] = [],
): ShoppingGroup[] => {
  interface Groep {
    ingredientId?: string;
    fallbackLabel: string;
    contributions: Contribution[];
  }
  const groepen = new Map<string, Groep>();

  for (const selection of selections) {
    for (const item of scaleRecipe(selection.recipe, selection.servings, library)) {
      // "Peper en zout naar smaak" heeft geen hoeveelheid en valt dus ook niet
      // te kopen; die regels blijven bij het recept.
      if (item.exactAmount === undefined || item.unit === undefined) continue;
      const naam = item.line.name ?? item.ingredient?.name ?? '';
      const key = item.line.ingredientId ?? `vrij:${normalizeName(naam)}`;
      const groep = groepen.get(key) ?? {
        ingredientId: item.line.ingredientId,
        fallbackLabel: naam,
        contributions: [],
      };
      groep.contributions.push({
        recipeId: selection.recipe.id,
        title: selection.recipe.title,
        amount: item.exactAmount,
        unit: item.unit,
        optional: item.line.optional,
      });
      groepen.set(key, groep);
    }
  }

  const lines: ShoppingLine[] = [];

  for (const [groupKey, groep] of groepen) {
    const ingredient = library.get(groep.ingredientId);
    const target = chooseTarget(groep.contributions);

    interface Bucket {
      dimension: Dimension;
      base: number;
      preferred?: Unit;
      preferredBase: number;
      contributions: Contribution[];
    }
    const buckets = new Map<string, Bucket>();

    for (const contribution of groep.contributions) {
      const eigenDimensie = dimensionOf(contribution.unit);
      let dimension = eigenDimensie;
      let base: number | null = null;
      let bucketKey = aggregationKey(contribution.unit);

      if (target && target !== 'aantal') {
        base = convertToBase(contribution.amount, contribution.unit, target, ingredient);
        if (base !== null) {
          dimension = target;
          bucketKey = target;
        }
      }
      if (base === null) {
        // Geen omrekenfactor: de regel telt alleen op binnen zijn eigen eenheid.
        base = convertToBase(contribution.amount, contribution.unit, eigenDimensie, ingredient);
        dimension = eigenDimensie;
        bucketKey = aggregationKey(contribution.unit);
      }

      const bucket = buckets.get(bucketKey) ?? {
        dimension,
        base: 0,
        preferredBase: -1,
        contributions: [],
      };
      bucket.base += base ?? 0;
      bucket.contributions.push(contribution);
      // De eenheid van de grootste bijdrage bepaalt hoe het totaal getoond wordt.
      if ((base ?? 0) > bucket.preferredBase && dimensionOf(contribution.unit) === dimension) {
        bucket.preferredBase = base ?? 0;
        bucket.preferred = contribution.unit;
      }
      buckets.set(bucketKey, bucket);
    }

    for (const [bucketKey, bucket] of buckets) {
      const ruw = fromBase(bucket.base, bucket.dimension, bucket.preferred);
      const quantity: Quantity = { amount: roundInUnit(ruw.amount, ruw.unit), unit: ruw.unit };
      lines.push({
        key: `${groupKey}|${bucketKey}`,
        ingredientId: groep.ingredientId,
        label: library.label(groep.ingredientId, groep.fallbackLabel, quantity.amount !== 1),
        category: ingredient?.category ?? 'overig',
        quantity,
        optional: bucket.contributions.every((c) => c.optional),
        sources: bucket.contributions.map((c) => ({
          recipeId: c.recipeId,
          title: c.title,
          quantity: { amount: roundInUnit(c.amount, c.unit), unit: c.unit },
          optional: c.optional,
        })),
        manual: false,
      });
    }
  }

  for (const item of manualItems) {
    lines.push({
      key: `los:${item.id}`,
      label: item.text,
      category: item.category,
      quantity: null,
      optional: false,
      sources: [],
      manual: true,
    });
  }

  return CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    lines: lines
      .filter((line) => line.category === category)
      .sort((a, b) => a.label.localeCompare(b.label, 'nl')),
  })).filter((group) => group.lines.length > 0);
};
