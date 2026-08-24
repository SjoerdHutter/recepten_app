import { describe, expect, it } from 'vitest';
import {
  addSynonyms,
  changeCategory,
  countUsage,
  deleteIngredient,
  linkRecipeLine,
  mergeIngredients,
  renameIngredient,
  type LibraryState,
} from './edits';
import { createLibrary } from './library';
import { makeRecipe, testIngredients } from '../testing/fixtures';

const state = (): LibraryState => ({
  ingredients: testIngredients.map((item) => ({ ...item })),
  recipes: [
    makeRecipe({
      id: 'soep',
      title: 'Soep',
      ingredients: [
        { amount: 2, unit: 'stuks', ingredientId: 'ui' },
        { amount: 1, unit: 'teentje', ingredientId: 'knoflook' },
      ],
    }),
    makeRecipe({
      id: 'salade',
      title: 'Salade',
      ingredients: [
        { amount: 1, unit: 'stuks', ingredientId: 'ui' },
        { amount: 2, unit: 'el', name: 'sjalotjes' },
      ],
    }),
  ],
});

describe('samenvoegen', () => {
  it('laat elk recept naar het overgebleven ingrediënt wijzen', () => {
    const uit = mergeIngredients(state(), 'ui', 'knoflook');
    const verwijzingen = uit.state.recipes.flatMap((recipe) =>
      recipe.ingredients.map((line) => line.ingredientId),
    );
    expect(verwijzingen).not.toContain('ui');
    // Twee regels verwezen naar ui, één naar knoflook: samen drie.
    expect(countUsage(uit.state.recipes, 'knoflook')).toBe(3);
  });

  it('haalt het opgeheven ingrediënt uit de bibliotheek', () => {
    const uit = mergeIngredients(state(), 'ui', 'knoflook');
    expect(uit.state.ingredients.map((item) => item.id)).not.toContain('ui');
    expect(uit.state.ingredients).toHaveLength(testIngredients.length - 1);
  });

  it('bewaart de oude naam als synoniem, zodat die blijft koppelen', () => {
    const uit = mergeIngredients(state(), 'ui', 'knoflook');
    const bibliotheek = createLibrary(uit.state.ingredients);
    expect(bibliotheek.match('ui')?.id).toBe('knoflook');
    expect(bibliotheek.match('uien')?.id).toBe('knoflook');
    expect(bibliotheek.match('gele ui')?.id).toBe('knoflook');
  });

  it('vult velden aan die het doel nog niet had', () => {
    // slagroom heeft een verpakkingsgrootte, olijfolie niet.
    const uit = mergeIngredients(state(), 'slagroom', 'olijfolie');
    const olie = uit.state.ingredients.find((item) => item.id === 'olijfolie');
    expect(olie?.packaging).toEqual({ amount: 250, unit: 'ml' });
    expect(olie?.allergens).toContain('melk');
    // Maar de eigen categorie en eenheid blijven van het doel.
    expect(olie?.category).toBe('houdbaar');
    expect(olie?.defaultUnit).toBe('el');
  });

  it('noemt welke bestanden herschreven moeten worden', () => {
    const uit = mergeIngredients(state(), 'slagroom', 'olijfolie');
    expect(uit.touchedCategories.sort()).toEqual(['houdbaar', 'zuivel']);
    expect(uit.changedRecipeIds).toEqual([]);
  });

  it('weigert samenvoegen met zichzelf', () => {
    expect(() => mergeIngredients(state(), 'ui', 'ui')).toThrow();
  });
});

describe('hernoemen', () => {
  it('houdt het id heel, want daar verwijzen de recepten naar', () => {
    const uit = renameIngredient(state(), 'ui', 'gele ui', 'gele uien');
    const ui = uit.state.ingredients.find((item) => item.id === 'ui');
    expect(ui?.name).toBe('gele ui');
    expect(ui?.plural).toBe('gele uien');
    expect(countUsage(uit.state.recipes, 'ui')).toBe(2);
  });

  it('bewaart de oude naam als synoniem', () => {
    const uit = renameIngredient(state(), 'ui', 'gele ui');
    expect(createLibrary(uit.state.ingredients).match('ui')?.id).toBe('ui');
  });
});

describe('synoniemen en categorie', () => {
  it('voegt synoniemen toe zonder dubbelingen', () => {
    const uit = addSynonyms(state(), 'ui', ['uitje', 'zilverui', 'UITJE']);
    const ui = uit.state.ingredients.find((item) => item.id === 'ui');
    expect(ui?.synonyms).toContain('zilverui');
    expect(ui?.synonyms.filter((s) => s.toLowerCase() === 'uitje')).toHaveLength(1);
  });

  it('verplaatst een ingrediënt naar een andere categorie en noemt beide bestanden', () => {
    const uit = changeCategory(state(), 'ui', 'diepvries');
    expect(uit.state.ingredients.find((item) => item.id === 'ui')?.category).toBe('diepvries');
    expect(uit.touchedCategories.sort()).toEqual(['diepvries', 'groente-en-fruit']);
  });
});

describe('koppelen en verwijderen', () => {
  it('koppelt een losse receptregel aan een ingrediënt', () => {
    const uit = linkRecipeLine(state(), 'salade', 1, 'ui');
    const regel = uit.state.recipes.find((r) => r.id === 'salade')?.ingredients[1];
    expect(regel?.ingredientId).toBe('ui');
    expect(regel?.name).toBeUndefined();
    expect(uit.changedRecipeIds).toEqual(['salade']);
  });

  it('verwijdert alleen wat nergens gebruikt wordt', () => {
    expect(() => deleteIngredient(state(), 'ui')).toThrow(/nog in 2/);
    const uit = deleteIngredient(state(), 'laurierblad');
    expect(uit.state.ingredients.map((item) => item.id)).not.toContain('laurierblad');
  });
});
