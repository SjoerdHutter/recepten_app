import type { Allergen, Difficulty, Method } from '../schema/enums';
import type { Recipe } from '../schema/recipe';
import { activeMinutes, totalMinutes } from '../schema/recipe';
import type { IngredientLibrary } from '../ingredients/library';
import { normalizeName } from '../ingredients/library';

export interface FilterState {
  query: string;
  /** Maximale tijd van begin tot eind, in minuten. */
  maxTotal: number | null;
  /** Maximale tijd dat je er echt bij moet staan. */
  maxActive: number | null;
  methods: Method[];
  difficulties: Difficulty[];
  /** Ingrediënt-ids die in het recept moeten zitten. */
  includeIngredients: string[];
  /** Ingrediënt-ids die er juist niet in mogen zitten. */
  excludeIngredients: string[];
  tags: string[];
  /** Harde uitsluiting: recepten met dit allergeen verdwijnen. */
  excludeAllergens: Allergen[];
  seasonOnly: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  query: '',
  maxTotal: null,
  maxActive: null,
  methods: [],
  difficulties: [],
  includeIngredients: [],
  excludeIngredients: [],
  tags: [],
  excludeAllergens: [],
  seasonOnly: false,
};

/** Verwijzingen naar ingrediënten in een recept, gekoppeld of niet. */
export const recipeIngredientKeys = (recipe: Recipe): Set<string> =>
  new Set(
    recipe.ingredients.map((line) => line.ingredientId ?? `vrij:${normalizeName(line.name ?? '')}`),
  );

/**
 * Een recept zonder seizoen is het hele jaar goed en valt dus ook onder
 * "nu in seizoen"; het is nooit uit het seizoen.
 */
export const isInSeason = (recipe: Recipe, month: number): boolean =>
  recipe.season.length === 0 || recipe.season.includes(month);

const searchHaystack = (recipe: Recipe, library: IngredientLibrary): string => {
  const namen = recipe.ingredients.map(
    (line) => library.get(line.ingredientId)?.name ?? line.name ?? '',
  );
  return normalizeName(
    [recipe.title, recipe.description, recipe.notes ?? '', ...recipe.tags, ...namen].join(' '),
  );
};

export interface FilterContext {
  library: IngredientLibrary;
  /** Maand 1-12, meegegeven zodat de filterlogica testbaar blijft. */
  month: number;
}

export const matchesFilters = (
  recipe: Recipe,
  filters: FilterState,
  context: FilterContext,
): boolean => {
  if (filters.maxTotal !== null && totalMinutes(recipe.times) > filters.maxTotal) return false;
  if (filters.maxActive !== null && activeMinutes(recipe.times) > filters.maxActive) return false;

  if (filters.methods.length > 0 && !filters.methods.some((m) => recipe.methods.includes(m))) {
    return false;
  }
  if (filters.difficulties.length > 0 && !filters.difficulties.includes(recipe.difficulty)) {
    return false;
  }
  if (filters.tags.length > 0 && !filters.tags.every((tag) => recipe.tags.includes(tag))) {
    return false;
  }
  if (filters.excludeAllergens.some((allergeen) => recipe.allergens.includes(allergeen))) {
    return false;
  }
  if (filters.seasonOnly && !isInSeason(recipe, context.month)) return false;

  if (filters.includeIngredients.length > 0 || filters.excludeIngredients.length > 0) {
    const keys = recipeIngredientKeys(recipe);
    if (!filters.includeIngredients.every((id) => keys.has(id))) return false;
    if (filters.excludeIngredients.some((id) => keys.has(id))) return false;
  }

  if (filters.query.trim()) {
    const woorden = normalizeName(filters.query).split(' ').filter(Boolean);
    const hooiberg = searchHaystack(recipe, context.library);
    if (!woorden.every((woord) => hooiberg.includes(woord))) return false;
  }

  return true;
};

export const filterRecipes = (
  recipes: Recipe[],
  filters: FilterState,
  context: FilterContext,
): Recipe[] => recipes.filter((recipe) => matchesFilters(recipe, filters, context));

/** Voor het bolletje met "3 filters actief" op de knop. */
export const countActiveFilters = (filters: FilterState): number =>
  (filters.maxTotal !== null ? 1 : 0) +
  (filters.maxActive !== null ? 1 : 0) +
  filters.methods.length +
  filters.difficulties.length +
  filters.includeIngredients.length +
  filters.excludeIngredients.length +
  filters.tags.length +
  filters.excludeAllergens.length +
  (filters.seasonOnly ? 1 : 0);

export const hasActiveFilters = (filters: FilterState): boolean =>
  countActiveFilters(filters) > 0 || filters.query.trim().length > 0;
