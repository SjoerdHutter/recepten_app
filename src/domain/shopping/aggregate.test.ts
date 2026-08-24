import { describe, expect, it } from 'vitest';
import { buildShoppingList } from './aggregate';
import { shoppingListToText } from './text';
import { makeRecipe, testLibrary } from '../testing/fixtures';
import { formatQuantity } from '../units/format';

const stoof = makeRecipe({
  id: 'stoof',
  title: 'Stoofpot',
  servings: 4,
  ingredients: [
    { amount: 2, unit: 'stuks', ingredientId: 'ui' },
    { amount: 2, unit: 'teentje', ingredientId: 'knoflook' },
    { amount: 2, unit: 'el', ingredientId: 'olijfolie' },
    { amount: 150, unit: 'ml', ingredientId: 'slagroom' },
  ],
});

const soep = makeRecipe({
  id: 'soep',
  title: 'Soep',
  servings: 4,
  ingredients: [
    { amount: 200, unit: 'g', ingredientId: 'ui' },
    { amount: 1, unit: 'teentje', ingredientId: 'knoflook' },
    { amount: 1, unit: 'el', ingredientId: 'olijfolie' },
    { amount: 0.2, unit: 'l', ingredientId: 'slagroom' },
    { amount: 1, unit: 'stuks', ingredientId: 'laurierblad', optional: true },
  ],
});

const lijst = (servings = 4) =>
  buildShoppingList(
    [
      { recipe: stoof, servings },
      { recipe: soep, servings },
    ],
    testLibrary,
  );

const zoekRegel = (label: string) =>
  lijst()
    .flatMap((g) => g.lines)
    .find((line) => line.label === label);

describe('boodschappenlijst', () => {
  it('telt hetzelfde ingrediënt uit verschillende recepten op', () => {
    const knoflook = zoekRegel('knoflook');
    expect(formatQuantity(knoflook!.quantity!)).toBe('3 teentjes');
  });

  it('rekent stuks om naar grammen via de bibliotheek', () => {
    // 2 uien is ongeveer 300 g, plus 200 g uit de soep.
    const ui = zoekRegel('uien');
    expect(formatQuantity(ui!.quantity!)).toBe('500 g');
  });

  it('telt milliliter en liter bij elkaar op', () => {
    const room = zoekRegel('slagroom');
    expect(formatQuantity(room!.quantity!)).toBe('350 ml');
  });

  it('houdt lepels als lepels zolang het klein blijft', () => {
    const olie = zoekRegel('olijfolie');
    expect(formatQuantity(olie!.quantity!)).toBe('3 el');
  });

  it('laat per regel zien uit welk recept hij komt', () => {
    const ui = zoekRegel('uien');
    expect(ui!.sources.map((s) => s.title).sort()).toEqual(['Soep', 'Stoofpot']);
    expect(formatQuantity(ui!.sources.find((s) => s.title === 'Soep')!.quantity)).toBe('200 g');
  });

  it('groepeert per supermarktcategorie in looproutevolgorde', () => {
    const categorieën = lijst().map((g) => g.category);
    expect(categorieën).toEqual(['groente-en-fruit', 'zuivel', 'kruiden', 'houdbaar']);
  });

  it('markeert een regel alleen als optioneel wanneer geen enkel recept hem nodig heeft', () => {
    expect(zoekRegel('laurierblad')?.optional).toBe(true);
  });

  it('schaalt mee met het aantal personen', () => {
    const acht = buildShoppingList([{ recipe: stoof, servings: 8 }], testLibrary);
    const knoflook = acht.flatMap((g) => g.lines).find((l) => l.label === 'knoflook');
    expect(formatQuantity(knoflook!.quantity!)).toBe('4 teentjes');
  });

  it('houdt regels gescheiden als er geen omrekening bestaat', () => {
    const raar = makeRecipe({
      id: 'raar',
      title: 'Raar',
      ingredients: [
        { amount: 2, unit: 'el', ingredientId: 'olijfolie' },
        { amount: 100, unit: 'g', ingredientId: 'olijfolie' },
      ],
    });
    const regels = buildShoppingList([{ recipe: raar, servings: 4 }], testLibrary).flatMap(
      (g) => g.lines,
    );
    expect(regels).toHaveLength(2);
    expect(regels.map((r) => formatQuantity(r.quantity!)).sort()).toEqual(['100 g', '2 el']);
  });

  it('neemt losse items op in hun eigen categorie', () => {
    const groepen = buildShoppingList([], testLibrary, [
      { id: 'a1', text: 'wc-papier', category: 'non-food' },
    ]);
    expect(groepen).toHaveLength(1);
    expect(groepen[0]?.lines[0]?.label).toBe('wc-papier');
    expect(groepen[0]?.lines[0]?.manual).toBe(true);
  });

  it('houdt de sleutel van een regel stabiel, zodat een vinkje blijft staan', () => {
    const eerste = zoekRegel('uien')?.key;
    const tweede = zoekRegel('uien')?.key;
    expect(eerste).toBe(tweede);
    expect(eerste).toBe('ui|massa');
  });

  it('exporteert als platte tekst met kopjes', () => {
    const tekst = shoppingListToText(lijst());
    expect(tekst).toContain('GROENTE EN FRUIT');
    expect(tekst).toContain('- 500 g uien');
    expect(tekst).toContain('- 3 teentjes knoflook');
  });
});
