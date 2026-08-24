import { describe, expect, it } from 'vitest';
import { analyseLibrary, nameSimilarity } from './maintenance';
import { ingredientSchema } from '../schema/ingredient';
import { makeRecipe, testIngredients } from '../testing/fixtures';
import type { LibraryState } from './edits';

const extra = (raw: Parameters<typeof ingredientSchema.parse>[0]) => ingredientSchema.parse(raw);

const state = (): LibraryState => ({
  ingredients: [
    ...testIngredients,
    // Een dubbeling die je met de hand zou maken.
    extra({ id: 'gele-ui', name: 'gele ui', category: 'groente-en-fruit', defaultUnit: 'stuks' }),
    // En eentje die nergens gebruikt wordt.
    extra({ id: 'sereh', name: 'sereh', category: 'kruiden', defaultUnit: 'stengel' }),
  ],
  recipes: [
    makeRecipe({
      id: 'soep',
      title: 'Soep',
      ingredients: [
        { amount: 2, unit: 'stuks', ingredientId: 'ui' },
        { amount: 1, unit: 'teentje', ingredientId: 'knoflook' },
        // Met de hand op github.com toegevoegd, nog niet gekoppeld.
        { amount: 2, unit: 'el', name: 'uien' },
        // Verwijst naar iets dat niet bestaat.
        { amount: 1, unit: 'stuks', ingredientId: 'bestaat-niet' },
      ],
    }),
  ],
});

describe('opruimanalyse', () => {
  it('vindt receptregels die nog niet gekoppeld zijn', () => {
    const rapport = analyseLibrary(state());
    expect(rapport.unlinked).toHaveLength(1);
    expect(rapport.unlinked[0]?.name).toBe('uien');
    expect(rapport.unlinked[0]?.lineIndex).toBe(2);
  });

  it('stelt meteen de juiste koppeling voor', () => {
    const rapport = analyseLibrary(state());
    expect(rapport.unlinked[0]?.suggestion?.id).toBe('ui');
  });

  it('meldt verwijzingen naar een ingrediënt dat niet bestaat', () => {
    const rapport = analyseLibrary(state());
    expect(rapport.missing).toHaveLength(1);
    expect(rapport.missing[0]?.ingredientId).toBe('bestaat-niet');
    expect(rapport.missing[0]?.recipeTitle).toBe('Soep');
  });

  it('spoort verweesde ingrediënten op', () => {
    const rapport = analyseLibrary(state());
    const ids = rapport.orphans.map((item) => item.id);
    expect(ids).toContain('sereh');
    expect(ids).toContain('gele-ui');
    expect(ids).not.toContain('ui');
  });

  it('telt hoe vaak elk ingrediënt gebruikt wordt', () => {
    const rapport = analyseLibrary(state());
    expect(rapport.usage.get('ui')).toBe(1);
    expect(rapport.usage.get('knoflook')).toBe(1);
    expect(rapport.usage.get('sereh')).toBeUndefined();
  });

  it('vindt dubbelingen via een gedeeld synoniem', () => {
    const rapport = analyseLibrary(state());
    // "gele ui" is de naam van het ene en een synoniem van het andere.
    const paar = rapport.duplicates.find((d) => [d.a.id, d.b.id].sort().join() === 'gele-ui,ui');
    expect(paar).toBeDefined();
  });

  it('meldt niets als alles klopt', () => {
    const schoon = analyseLibrary({
      ingredients: [testIngredients[0]!],
      recipes: [
        makeRecipe({
          id: 'x',
          title: 'X',
          ingredients: [{ amount: 1, unit: 'stuks', ingredientId: 'ui' }],
        }),
      ],
    });
    expect(schoon.total).toBe(0);
  });
});

describe('gelijkenis tussen namen', () => {
  it('herkent enkelvoud en meervoud als sterk gelijkend', () => {
    expect(nameSimilarity('courgette', 'courgettes')).toBeGreaterThan(0.9);
    expect(nameSimilarity('tomaat', 'tomaten')).toBeGreaterThan(0.7);
  });

  it('houdt verschillende ingrediënten uit elkaar', () => {
    expect(nameSimilarity('ui', 'knoflook')).toBeLessThan(0.3);
    expect(nameSimilarity('boter', 'bloem')).toBeLessThan(0.5);
  });
});

describe('samengestelde producten', () => {
  const paren = (ingredienten: Array<[string, string]>) =>
    analyseLibrary({
      ingredients: ingredienten.map(([id, name]) =>
        extra({ id, name, category: 'houdbaar', defaultUnit: 'g' }),
      ),
      recipes: [],
    }).duplicates;

  it('meldt sap en azijn niet als dubbeling van hun basisproduct', () => {
    // Op letterparen lijken deze bijna identiek, maar het zijn andere producten.
    expect(
      paren([
        ['sinaasappel', 'sinaasappel'],
        ['sinaasappelsap', 'sinaasappelsap'],
      ]),
    ).toEqual([]);
    expect(
      paren([
        ['witte-wijn', 'witte wijn'],
        ['azijn', 'witte wijnazijn'],
      ]),
    ).toEqual([]);
  });

  it('meldt een meervoud wél, want dat is dezelfde zaak', () => {
    expect(
      paren([
        ['courgette', 'courgette'],
        ['courgettes', 'courgettes'],
      ]),
    ).toHaveLength(1);
  });
});
