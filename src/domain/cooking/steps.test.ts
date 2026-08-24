import { describe, expect, it } from 'vitest';
import { buildSteps, unmentionedIngredients } from './steps';
import { scaleRecipe } from '../scaling/scale';
import { makeRecipe, testLibrary } from '../testing/fixtures';

const recept = makeRecipe({
  id: 'stoof',
  title: 'Stoofpot',
  servings: 4,
  ingredients: [
    { amount: 500, unit: 'g', ingredientId: 'ui' },
    { amount: 2, unit: 'teentje', ingredientId: 'knoflook' },
    { amount: 200, unit: 'ml', ingredientId: 'slagroom' },
    { amount: 2, unit: 'stuks', ingredientId: 'laurierblad' },
  ],
  steps: [
    { text: 'Snipper de uien en pers de knoflook erbij.' },
    { text: 'Laat drie uur stoven en roer elk halfuur even.', timer: 10800 },
    { text: 'Roer de slagroom erdoor en laat 5 minuten inkoken.', timer: 300 },
    { text: 'Breng op smaak en serveer.' },
  ],
});

const stappen = () => buildSteps(recept, scaleRecipe(recept, 4, testLibrary));

describe('ingrediënten bij een stap zoeken', () => {
  it('vindt ingrediënten die in de tekst genoemd worden', () => {
    const labels = stappen()[0]?.ingredients.map((i) => i.label);
    expect(labels).toEqual(['uien', 'knoflook']);
  });

  it('herkent het meervoud in de tekst bij een enkelvoudige naam', () => {
    // Het ingrediënt heet "ui", de stap zegt "uien".
    expect(stappen()[0]?.ingredients.some((i) => i.ingredient?.id === 'ui')).toBe(true);
  });

  it('geeft de meegeschaalde hoeveelheid terug', () => {
    const voorAcht = buildSteps(recept, scaleRecipe(recept, 8, testLibrary));
    const ui = voorAcht[0]?.ingredients.find((i) => i.ingredient?.id === 'ui');
    expect(ui?.amount).toBe(1000);
  });

  it('laat een stap zonder ingrediënten leeg', () => {
    expect(stappen()[3]?.ingredients).toEqual([]);
  });

  it('trapt niet in een woord dat toevallig zo begint', () => {
    const raar = makeRecipe({
      id: 'raar',
      title: 'Raar',
      ingredients: [{ amount: 1, unit: 'stuks', ingredientId: 'ui' }],
      steps: [{ text: 'Dit is uiteraard een stap zonder ingrediënten.' }],
    });
    expect(buildSteps(raar, scaleRecipe(raar, 4, testLibrary))[0]?.ingredients).toEqual([]);
  });

  it('gebruikt het step-veld zodra een recept dat wél invult', () => {
    const gekoppeld = makeRecipe({
      id: 'gekoppeld',
      title: 'Gekoppeld',
      ingredients: [
        { amount: 1, unit: 'stuks', ingredientId: 'ui', step: 2 },
        { amount: 1, unit: 'teentje', ingredientId: 'knoflook', step: 1 },
      ],
      steps: [{ text: 'Eerst iets.' }, { text: 'Dan iets anders.' }],
    });
    const uit = buildSteps(gekoppeld, scaleRecipe(gekoppeld, 4, testLibrary));
    expect(uit[0]?.ingredients.map((i) => i.ingredient?.id)).toEqual(['knoflook']);
    expect(uit[1]?.ingredients.map((i) => i.ingredient?.id)).toEqual(['ui']);
  });

  it('noemt wat nergens genoemd wordt, zodat het niet zoekraakt', () => {
    const vergeten = unmentionedIngredients(stappen(), scaleRecipe(recept, 4, testLibrary));
    expect(vergeten.map((i) => i.ingredient?.id)).toEqual(['laurierblad']);
  });
});

describe('timers bij een stap', () => {
  it('haalt de tijden uit de tekst', () => {
    expect(stappen()[1]?.mentions.map((m) => m.seconds)).toEqual([10800, 1800]);
  });

  it('laat het timer-veld weg als die tijd al in de tekst staat', () => {
    // "drie uur" staat er al; een tweede knop van 3 uur voegt niets toe.
    expect(stappen()[1]?.fieldTimer).toBeUndefined();
    expect(stappen()[2]?.fieldTimer).toBeUndefined();
  });

  it('houdt het timer-veld wél als de tekst er niets over zegt', () => {
    const stil = makeRecipe({
      id: 'stil',
      title: 'Stil',
      steps: [{ text: 'Laat rusten tot het lauw is.', timer: 1200 }],
    });
    const uit = buildSteps(stil, scaleRecipe(stil, 4, testLibrary));
    expect(uit[0]?.fieldTimer).toBe(1200);
    expect(uit[0]?.mentions).toEqual([]);
  });
});
