import { describe, expect, it } from 'vitest';
import { scaleRecipe } from './scale';
import { makeRecipe, testLibrary } from '../testing/fixtures';

const recept = makeRecipe({
  id: 'test',
  title: 'Test',
  servings: 4,
  ingredients: [
    { amount: 800, unit: 'g', ingredientId: 'ui' },
    { amount: 2, unit: 'stuks', ingredientId: 'laurierblad', scales: false },
    { amount: 3, unit: 'stuks', ingredientId: 'ei' },
    { amount: 1, unit: 'snufje', ingredientId: 'zout' },
    { amount: 2, unit: 'el', ingredientId: 'olijfolie' },
  ],
});

describe('schalen naar een ander aantal personen', () => {
  it('laat alles staan bij hetzelfde aantal', () => {
    const geschaald = scaleRecipe(recept, 4, testLibrary);
    expect(geschaald.map((i) => i.amount)).toEqual([800, 2, 3, 1, 2]);
  });

  it('rekent netjes om naar drie personen', () => {
    const geschaald = scaleRecipe(recept, 3, testLibrary);
    expect(geschaald[0]?.amount).toBe(600); // 800 g maal 0,75
    expect(geschaald[4]?.amount).toBe(1.5); // 2 el maal 0,75
  });

  it('laat ingrediënten met "schaalt niet mee" staan', () => {
    const geschaald = scaleRecipe(recept, 8, testLibrary);
    expect(geschaald[1]?.amount).toBe(2);
    expect(geschaald[1]?.scaled).toBe(false);
    expect(geschaald[0]?.amount).toBe(1600);
  });

  it('geeft geen derde ei', () => {
    const geschaald = scaleRecipe(recept, 1, testLibrary);
    expect(geschaald[2]?.amount).toBe(1); // 3 eieren gedeeld door 4 wordt er 1
    expect(geschaald[3]?.amount).toBe(1); // een snufje blijft een snufje
  });

  it('bewaart de onafgeronde hoeveelheid om verder mee te rekenen', () => {
    const geschaald = scaleRecipe(recept, 3, testLibrary);
    expect(geschaald[2]?.exactAmount).toBeCloseTo(2.25);
    expect(geschaald[2]?.amount).toBe(2.5);
  });

  it('toont de naam in het meervoud als er meer dan één is', () => {
    const geschaald = scaleRecipe(recept, 4, testLibrary);
    expect(geschaald[2]?.label).toBe('eieren');
    expect(scaleRecipe(recept, 1, testLibrary)[2]?.label).toBe('ei');
  });
});
