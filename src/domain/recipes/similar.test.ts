import { describe, expect, it } from 'vitest';
import { findSimilarRecipes, recipeIngredientIdSet } from './similar';
import { makeRecipe } from '../testing/fixtures';

const bestaand = [
  makeRecipe({
    id: 'pasta-pesto',
    title: 'Pasta met pesto en pijnboompitten',
    ingredients: [
      { amount: 350, unit: 'g', ingredientId: 'spaghetti' },
      { amount: 2, unit: 'teentje', ingredientId: 'knoflook' },
      { amount: 30, unit: 'g', ingredientId: 'olijfolie' },
    ],
  }),
  makeRecipe({
    id: 'uiensoep',
    title: 'Franse uiensoep',
    ingredients: [{ amount: 6, unit: 'stuks', ingredientId: 'ui' }],
  }),
];

const kandidaat = (title: string, ingredientIds: string[]) => ({
  id: 'nieuw',
  title,
  ingredientIds,
});

describe('lijkt dit op een bestaand recept', () => {
  it('waarschuwt bij een omgedraaide titel met dezelfde ingrediënten', () => {
    const treffers = findSimilarRecipes(
      kandidaat('Pesto pasta met pijnboompitten', ['spaghetti', 'knoflook', 'olijfolie']),
      bestaand,
    );
    expect(treffers[0]?.recipe.id).toBe('pasta-pesto');
  });

  it('zwijgt bij een heel ander gerecht', () => {
    expect(findSimilarRecipes(kandidaat('Appeltaart', ['appel', 'bloem']), bestaand)).toHaveLength(
      0,
    );
  });

  it('waarschuwt niet over het recept dat je aan het bewerken bent', () => {
    const zelf = { id: 'uiensoep', title: 'Franse uiensoep', ingredientIds: ['ui'] };
    expect(findSimilarRecipes(zelf, bestaand)).toHaveLength(0);
  });

  it('kijkt niet alleen naar de titel', () => {
    // Een woord gemeen, totaal andere ingrediënten: geen waarschuwing.
    const treffers = findSimilarRecipes(
      kandidaat('Uiensoep met kaas', ['kaas', 'rijst']),
      bestaand,
    );
    expect(treffers).toHaveLength(0);
  });

  it('waarschuwt wel bij een identieke titel', () => {
    // Twee recepten met dezelfde naam wil je sowieso weten, ook als de
    // ingrediënten verschillen.
    const treffers = findSimilarRecipes(kandidaat('Franse uiensoep', ['kabeljauw']), bestaand);
    expect(treffers[0]?.recipe.id).toBe('uiensoep');
    expect(treffers[0]?.reason).toBe('bijna dezelfde titel');
  });

  it('pakt de ingrediënt-ids uit een recept', () => {
    expect(recipeIngredientIdSet(bestaand[1]!)).toEqual(['ui']);
  });
});
