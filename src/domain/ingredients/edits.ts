import type { Category } from '../schema/enums';
import type { Ingredient } from '../schema/ingredient';
import type { Recipe } from '../schema/recipe';
import type { Unit } from '../units/units';
import { normalizeName } from './library';

/**
 * Bewerkingen op de bibliotheek als zuivere functies: erin gaat de huidige
 * verzameling, eruit komt een nieuwe. Geen netwerk, geen bestanden. Dat maakt ze
 * testbaar, en het laat de UI eerst tonen wat er gaat gebeuren voordat er iets
 * gecommit wordt — bij samenvoegen is dat geen luxe, want dat raakt elk recept
 * dat het ingrediënt gebruikt.
 */

export interface LibraryState {
  ingredients: Ingredient[];
  recipes: Recipe[];
}

export interface LibraryEdit {
  state: LibraryState;
  /** Voor de commitboodschap en de bevestiging in beeld. */
  summary: string;
  /** Bibliotheekbestanden die herschreven moeten worden. */
  touchedCategories: Category[];
  changedRecipeIds: string[];
}

const uniek = (waarden: Array<string | undefined>): string[] => {
  const gezien = new Set<string>();
  const uit: string[] = [];
  for (const waarde of waarden) {
    const schoon = waarde?.trim();
    if (!schoon) continue;
    const sleutel = normalizeName(schoon);
    if (!sleutel || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(schoon);
  }
  return uit;
};

const vervang = (ingredients: Ingredient[], bijgewerkt: Ingredient): Ingredient[] =>
  ingredients.map((item) => (item.id === bijgewerkt.id ? bijgewerkt : item));

const eis = (ingredient: Ingredient | undefined, id: string): Ingredient => {
  if (!ingredient) throw new Error(`Ingrediënt "${id}" bestaat niet.`);
  return ingredient;
};

const zoek = (state: LibraryState, id: string): Ingredient =>
  eis(
    state.ingredients.find((item) => item.id === id),
    id,
  );

/** Hoeveel receptregels naar dit ingrediënt verwijzen. */
export const countUsage = (recipes: Recipe[], id: string): number =>
  recipes.reduce(
    (totaal, recipe) =>
      totaal + recipe.ingredients.filter((line) => line.ingredientId === id).length,
    0,
  );

/**
 * Voegt twee ingrediënten samen. Alles wat naar het opgeheven ingrediënt
 * verwees, wijst daarna naar het overgebleven ingrediënt, en de naam van het
 * opgeheven ingrediënt blijft als synoniem bestaan. Dat laatste is belangrijk:
 * anders koppelt de tekstparser die naam de volgende keer weer aan niets.
 */
export const mergeIngredients = (
  state: LibraryState,
  fromId: string,
  intoId: string,
): LibraryEdit => {
  if (fromId === intoId)
    throw new Error('Een ingrediënt kan niet met zichzelf samengevoegd worden.');
  const bron = zoek(state, fromId);
  const doel = zoek(state, intoId);

  const samengevoegd: Ingredient = {
    ...doel,
    synonyms: uniek([
      ...doel.synonyms,
      bron.name,
      bron.plural,
      bron.nameEn,
      ...bron.synonyms,
    ]).filter((naam) => normalizeName(naam) !== normalizeName(doel.name)),
    // Velden die het doel nog niet had, komen van de bron.
    ...(doel.plural ? {} : bron.plural ? { plural: bron.plural } : {}),
    ...(doel.nameEn ? {} : bron.nameEn ? { nameEn: bron.nameEn } : {}),
    ...(doel.packaging ? {} : bron.packaging ? { packaging: bron.packaging } : {}),
    ...(doel.price ? {} : bron.price ? { price: bron.price } : {}),
    ...(doel.nutrition ? {} : bron.nutrition ? { nutrition: bron.nutrition } : {}),
    conversions: { ...bron.conversions, ...doel.conversions },
    allergens: uniek([...doel.allergens, ...bron.allergens]) as Ingredient['allergens'],
  };

  const changedRecipeIds: string[] = [];
  const recipes = state.recipes.map((recipe) => {
    if (!recipe.ingredients.some((line) => line.ingredientId === fromId)) return recipe;
    changedRecipeIds.push(recipe.id);
    return {
      ...recipe,
      ingredients: recipe.ingredients.map((line) =>
        line.ingredientId === fromId ? { ...line, ingredientId: intoId } : line,
      ),
    };
  });

  return {
    state: {
      ingredients: vervang(state.ingredients, samengevoegd).filter((item) => item.id !== fromId),
      recipes,
    },
    summary: `${bron.name} samengevoegd met ${doel.name}`,
    touchedCategories: uniek([bron.category, doel.category]) as Category[],
    changedRecipeIds,
  };
};

/**
 * Hernoemen verandert alleen de weergavenaam. Het id blijft staan, want dat is
 * waar elk recept naar verwijst. De oude naam wordt een synoniem, zodat een
 * geplakt recept met de oude naam blijft koppelen.
 */
export const renameIngredient = (
  state: LibraryState,
  id: string,
  naam: string,
  meervoud?: string,
): LibraryEdit => {
  const huidig = zoek(state, id);
  const nieuw: Ingredient = {
    ...huidig,
    name: naam.trim(),
    ...(meervoud?.trim() ? { plural: meervoud.trim() } : {}),
    synonyms: uniek([...huidig.synonyms, huidig.name, huidig.plural]).filter(
      (synoniem) => normalizeName(synoniem) !== normalizeName(naam),
    ),
  };
  return {
    state: { ingredients: vervang(state.ingredients, nieuw), recipes: state.recipes },
    summary: `${huidig.name} hernoemd naar ${nieuw.name}`,
    touchedCategories: [huidig.category],
    changedRecipeIds: [],
  };
};

export const addSynonyms = (state: LibraryState, id: string, synoniemen: string[]): LibraryEdit => {
  const huidig = zoek(state, id);
  const nieuw: Ingredient = {
    ...huidig,
    synonyms: uniek([...huidig.synonyms, ...synoniemen]).filter(
      (synoniem) => normalizeName(synoniem) !== normalizeName(huidig.name),
    ),
  };
  const aantal = nieuw.synonyms.length - huidig.synonyms.length;
  return {
    state: { ingredients: vervang(state.ingredients, nieuw), recipes: state.recipes },
    summary:
      aantal === 1
        ? `Synoniem toegevoegd aan ${huidig.name}`
        : `${aantal} synoniemen toegevoegd aan ${huidig.name}`,
    touchedCategories: [huidig.category],
    changedRecipeIds: [],
  };
};

/** Een categorie corrigeren verplaatst het ingrediënt naar een ander bestand. */
export const changeCategory = (
  state: LibraryState,
  id: string,
  categorie: Category,
): LibraryEdit => {
  const huidig = zoek(state, id);
  const nieuw: Ingredient = { ...huidig, category: categorie };
  return {
    state: { ingredients: vervang(state.ingredients, nieuw), recipes: state.recipes },
    summary: `${huidig.name} verplaatst naar ${categorie}`,
    touchedCategories: uniek([huidig.category, categorie]) as Category[],
    changedRecipeIds: [],
  };
};

export const setDefaultUnit = (state: LibraryState, id: string, unit: Unit): LibraryEdit => {
  const huidig = zoek(state, id);
  const nieuw: Ingredient = { ...huidig, defaultUnit: unit };
  return {
    state: { ingredients: vervang(state.ingredients, nieuw), recipes: state.recipes },
    summary: `Standaardeenheid van ${huidig.name} is nu ${unit}`,
    touchedCategories: [huidig.category],
    changedRecipeIds: [],
  };
};

/**
 * De richtprijs bijstellen. De peildatum gaat automatisch mee: een bedrag
 * zonder datum zegt over een jaar niets meer, en juist die datum laat de app
 * zien bij elke schatting.
 */
export const setPrice = (
  state: LibraryState,
  id: string,
  amount: number,
  per: Unit,
): LibraryEdit => {
  const huidig = zoek(state, id);
  const nieuw: Ingredient = {
    ...huidig,
    price: { amount, per, date: new Date().toISOString().slice(0, 10) },
  };
  return {
    state: { ingredients: vervang(state.ingredients, nieuw), recipes: state.recipes },
    summary: `Prijs van ${huidig.name} bijgewerkt`,
    touchedCategories: [huidig.category],
    changedRecipeIds: [],
  };
};

/** Koppelt een losse receptregel alsnog aan een ingrediënt uit de bibliotheek. */
export const linkRecipeLine = (
  state: LibraryState,
  recipeId: string,
  lineIndex: number,
  ingredientId: string,
): LibraryEdit => {
  const doel = zoek(state, ingredientId);
  const recept = state.recipes.find((recipe) => recipe.id === recipeId);
  if (!recept) throw new Error(`Recept "${recipeId}" bestaat niet.`);
  const regel = recept.ingredients[lineIndex];
  if (!regel) throw new Error('Deze receptregel bestaat niet.');

  const recipes = state.recipes.map((recipe) =>
    recipe.id === recipeId
      ? {
          ...recipe,
          ingredients: recipe.ingredients.map((line, index) => {
            if (index !== lineIndex) return line;
            const { name: _weg, ...rest } = line;
            return { ...rest, ingredientId };
          }),
        }
      : recipe,
  );

  return {
    state: { ingredients: state.ingredients, recipes },
    summary: `"${regel.name ?? regel.ingredientId ?? ''}" gekoppeld aan ${doel.name} in ${recept.title}`,
    touchedCategories: [],
    changedRecipeIds: [recipeId],
  };
};

/** Een ingrediënt verwijderen mag alleen als geen enkel recept het gebruikt. */
export const deleteIngredient = (state: LibraryState, id: string): LibraryEdit => {
  const huidig = zoek(state, id);
  const gebruik = countUsage(state.recipes, id);
  if (gebruik > 0) {
    throw new Error(
      `${huidig.name} wordt nog in ${gebruik} receptregel${gebruik === 1 ? '' : 's'} gebruikt.`,
    );
  }
  return {
    state: {
      ingredients: state.ingredients.filter((item) => item.id !== id),
      recipes: state.recipes,
    },
    summary: `${huidig.name} verwijderd uit de bibliotheek`,
    touchedCategories: [huidig.category],
    changedRecipeIds: [],
  };
};

/** Nieuwe ingrediënten toevoegen, bijvoorbeeld vanuit een import. */
export const addIngredients = (state: LibraryState, nieuwe: Ingredient[]): LibraryEdit => {
  const bestaand = new Set(state.ingredients.map((item) => item.id));
  const toegevoegd = nieuwe.filter((item) => !bestaand.has(item.id));
  return {
    state: { ingredients: [...state.ingredients, ...toegevoegd], recipes: state.recipes },
    summary:
      toegevoegd.length === 1 && toegevoegd[0]
        ? `${toegevoegd[0].name} toegevoegd aan de bibliotheek`
        : `${toegevoegd.length} ingrediënten toegevoegd aan de bibliotheek`,
    touchedCategories: uniek(toegevoegd.map((item) => item.category)) as Category[],
    changedRecipeIds: [],
  };
};
