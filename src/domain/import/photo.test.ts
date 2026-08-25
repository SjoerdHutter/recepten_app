import { describe, expect, it } from 'vitest';
import { createLibrary } from '../ingredients/library';
import { ingredientSchema, type Ingredient } from '../schema/ingredient';
import { extractJson, photoToRecipe } from './photo';

const ingredient = (deel: Record<string, unknown> & { id: string; name: string }): Ingredient =>
  ingredientSchema.parse({
    synonyms: [],
    category: 'houdbaar',
    defaultUnit: 'g',
    allergens: [],
    ...deel,
  });

const library = createLibrary([
  ingredient({ id: 'bloem', name: 'bloem', nameEn: 'flour' }),
  ingredient({ id: 'ui', name: 'ui', plural: 'uien', nameEn: 'onion', defaultUnit: 'stuks' }),
  ingredient({ id: 'zout', name: 'zout', nameEn: 'salt' }),
]);

describe('extractJson', () => {
  it('leest kaal JSON', () => {
    expect(extractJson('{"title":"Soep"}')).toEqual({ title: 'Soep' });
  });

  it('vist het uit een codeblok', () => {
    expect(extractJson('```json\n{"title":"Soep"}\n```')).toEqual({ title: 'Soep' });
  });

  it('vist het uit een antwoord met een zin ervoor', () => {
    expect(extractJson('Hier is het recept:\n{"title":"Soep"}\nSucces!')).toEqual({
      title: 'Soep',
    });
  });

  it('klaagt als er geen JSON in staat', () => {
    expect(() => extractJson('Ik zie geen recept op deze foto.')).toThrow();
  });
});

describe('photoToRecipe', () => {
  const antwoord = {
    title: 'Uiensoep',
    description: 'Van oma.',
    servings: 4,
    prepMinutes: 15,
    activeMinutes: 40,
    ingredients: ['200 g bloem', '3 uien, in ringen', 'zout naar smaak'],
    steps: ['Verwarm de oven voor op 350 F.', 'Snipper de uien.'],
    unreadable: ['... boter?'],
  };

  it('koppelt de ingrediënten aan de bibliotheek', () => {
    const uit = photoToRecipe(antwoord, library);
    expect(uit.ingredients[0]).toEqual({
      amount: 200,
      unit: 'g',
      ingredientId: 'bloem',
      name: 'bloem',
    });
    expect(uit.ingredients[1]).toMatchObject({ ingredientId: 'ui', amount: 3, unit: 'stuks' });
    expect(uit.ingredients[2]).toEqual({ ingredientId: 'zout', name: 'zout', scales: 'taste' });
  });

  it('rekent de oven om naar Celsius', () => {
    const uit = photoToRecipe(antwoord, library);
    expect(uit.steps[0]).toBe('Verwarm de oven voor op 175 °C.');
    expect(uit.ovenTemps?.[0]).toBe(175);
  });

  it('neemt de tijden en het aantal personen over', () => {
    const uit = photoToRecipe(antwoord, library);
    expect(uit.servings).toBe(4);
    expect(uit.times).toEqual({ prep: 15, active: 40, passive: 0 });
  });

  it('houdt de onleesbare regels apart en waarschuwt erover', () => {
    const uit = photoToRecipe(antwoord, library);
    expect(uit.leftovers).toContain('... boter?');
    expect(uit.warnings).toContain('1 regel was niet goed te lezen; die staat onderaan.');
  });

  it('zegt er altijd bij dat een taalmodel dit heeft overgetypt', () => {
    const uit = photoToRecipe(antwoord, library);
    expect(uit.warnings?.at(-1)).toMatch(/taalmodel/);
  });

  it('zet de bron erin als die meegegeven wordt', () => {
    const uit = photoToRecipe(antwoord, library, 'Kookboek van oma, blz. 12');
    expect(uit.source).toEqual({ type: 'text', text: 'Kookboek van oma, blz. 12' });
  });

  it('kan om met een leeg antwoord', () => {
    const uit = photoToRecipe({ title: '', ingredients: [], steps: [], unreadable: [] }, library);
    expect(uit.title).toBe('Naamloos recept');
    expect(uit.ingredients).toEqual([]);
  });

  it('weigert iets wat niet op het schema lijkt', () => {
    expect(() => photoToRecipe({ ingredients: 'geen lijst' }, library)).toThrow();
    expect(() => photoToRecipe(null, library)).toThrow();
  });
});
