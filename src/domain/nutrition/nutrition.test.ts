import { describe, expect, it } from 'vitest';
import {
  BETROUWBAAR_VANAF,
  coverage,
  gramsOf,
  matchesNutrition,
  recipeNutrition,
} from './nutrition';
import { createLibrary } from '../ingredients/library';
import { ingredientSchema } from '../schema/ingredient';
import { makeRecipe, testIngredients } from '../testing/fixtures';

/** Ronde getallen, zodat de sommen met de hand na te rekenen zijn. */
const metWaarden = testIngredients.map((item) => {
  if (item.id === 'ui') {
    return ingredientSchema.parse({
      ...item,
      nutrition: {
        kcal: 40,
        protein: 1,
        carbs: 9,
        fat: 0,
        fiber: 2,
        salt: 0,
        source: 'schatting',
        date: '2026-08-24',
      },
    });
  }
  if (item.id === 'slagroom') {
    return ingredientSchema.parse({
      ...item,
      // Room weegt iets meer dan water; zonder deze factor zou de app 1 g per ml aannemen.
      conversions: { ml: { g: 1.01 } },
      nutrition: {
        kcal: 340,
        protein: 2,
        carbs: 3,
        fat: 35,
        source: 'schatting',
        date: '2026-01-01',
      },
    });
  }
  if (item.id === 'olijfolie') {
    return ingredientSchema.parse({
      ...item,
      nutrition: {
        kcal: 880,
        protein: 0,
        carbs: 0,
        fat: 100,
        source: 'schatting',
        date: '2026-08-24',
      },
    });
  }
  return item;
});
const bibliotheek = createLibrary(metWaarden);

const olie = metWaarden.find((i) => i.id === 'olijfolie');
const room = metWaarden.find((i) => i.id === 'slagroom');
const ui = metWaarden.find((i) => i.id === 'ui');

describe('naar gram rekenen', () => {
  it('rekent massa rechtstreeks', () => {
    expect(gramsOf({ amount: 250, unit: 'g' }, ui)).toEqual({ grams: 250, assumed: false });
    expect(gramsOf({ amount: 1, unit: 'kg' }, ui)).toEqual({ grams: 1000, assumed: false });
  });

  it('gebruikt de omrekenfactor van het ingrediënt', () => {
    // 2 uien is 2 x 150 g.
    expect(gramsOf({ amount: 2, unit: 'stuks' }, ui)).toEqual({ grams: 300, assumed: false });
    // Room heeft een dichtheid, dus dit is geen aanname.
    expect(gramsOf({ amount: 100, unit: 'ml' }, room)).toEqual({ grams: 101, assumed: false });
  });

  it('neemt 1 gram per milliliter aan als de dichtheid ontbreekt, en zegt dat erbij', () => {
    // Olie weegt eigenlijk 0,92 g/ml; zonder factor wordt dat aangenomen.
    expect(gramsOf({ amount: 2, unit: 'el' }, olie)).toEqual({ grams: 30, assumed: true });
  });

  it('past de dichtheid ook toe op lepels, niet alleen op milliliters', () => {
    // De omrekening staat op ml, maar een recept meet in eetlepels. Zonder deze
    // stap zou die factor nooit gebruikt worden.
    const metDichtheid = ingredientSchema.parse({
      ...olie,
      conversions: { ml: { g: 0.92 } },
    });
    expect(gramsOf({ amount: 2, unit: 'el' }, metDichtheid)).toEqual({
      grams: 27.6,
      assumed: false,
    });
    expect(gramsOf({ amount: 100, unit: 'ml' }, metDichtheid)).toEqual({
      grams: 92,
      assumed: false,
    });
  });

  it('geeft niets terug voor wat niet te wegen valt', () => {
    const knoflook = metWaarden.find((i) => i.id === 'knoflook');
    expect(gramsOf({ amount: 1, unit: 'bosje' }, knoflook)).toBeNull();
  });
});

describe('voedingswaarde per portie', () => {
  const recept = makeRecipe({
    id: 'test',
    title: 'Test',
    servings: 4,
    ingredients: [
      { amount: 400, unit: 'g', ingredientId: 'ui' },
      { amount: 100, unit: 'ml', ingredientId: 'slagroom' },
    ],
  });

  it('telt de ingrediënten op en deelt door het aantal personen', () => {
    const uit = recipeNutrition(recept, bibliotheek);
    // 400 g ui = 160 kcal; 101 g room = 343,4 kcal.
    expect(uit.total.kcal).toBeCloseTo(503.4, 1);
    expect(uit.perServing.kcal).toBeCloseTo(125.85, 1);
    expect(uit.perServing.fat).toBeCloseTo(8.84, 1);
  });

  it('schaalt mee met het aantal personen zonder de portie te veranderen', () => {
    const voorAcht = recipeNutrition(recept, bibliotheek, 8);
    expect(voorAcht.total.kcal).toBeCloseTo(1006.8, 1);
    expect(voorAcht.perServing.kcal).toBeCloseTo(125.85, 1);
  });

  it('telt bij hoeveel gram er meegerekend is en hoeveel niet', () => {
    const metOnbekend = makeRecipe({
      id: 'half',
      title: 'Half bekend',
      servings: 2,
      ingredients: [
        { amount: 100, unit: 'g', ingredientId: 'ui' },
        // Ei heeft geen voedingswaarde in deze bibliotheek.
        { amount: 100, unit: 'g', ingredientId: 'ei' },
      ],
    });
    const uit = recipeNutrition(metOnbekend, bibliotheek);
    expect(uit.known).toBe(1);
    expect(uit.unknown).toBe(1);
    expect(uit.gramsCounted).toBe(100);
    expect(uit.gramsMissing).toBe(100);
    expect(coverage(uit)).toBe(0.5);
  });

  it('meldt de oudste peildatum en de herkomst', () => {
    const uit = recipeNutrition(recept, bibliotheek);
    expect(uit.oldestDate).toBe('2026-01-01');
    expect(uit.sources).toEqual(['schatting']);
  });

  it('telt hoeveel regels op een aangenomen dichtheid leunen', () => {
    const metOlie = makeRecipe({
      id: 'olie',
      title: 'Olie',
      ingredients: [{ amount: 2, unit: 'el', ingredientId: 'olijfolie' }],
    });
    expect(recipeNutrition(metOlie, bibliotheek).assumedDensity).toBe(1);
    expect(recipeNutrition(recept, bibliotheek).assumedDensity).toBe(0);
  });
});

describe('filteren op voedingswaarde', () => {
  const licht = makeRecipe({
    id: 'licht',
    title: 'Licht',
    servings: 4,
    ingredients: [{ amount: 400, unit: 'g', ingredientId: 'ui' }],
  });
  const zwaar = makeRecipe({
    id: 'zwaar',
    title: 'Zwaar',
    servings: 4,
    ingredients: [{ amount: 400, unit: 'ml', ingredientId: 'slagroom' }],
  });

  const filter = (patch: { maxKcal?: number | null; minProtein?: number | null }) =>
    [licht, zwaar]
      .filter((r) =>
        matchesNutrition(r, { maxKcal: null, minProtein: null, ...patch }, bibliotheek),
      )
      .map((r) => r.id);

  it('laat alles door zonder filter', () => {
    expect(filter({})).toEqual(['licht', 'zwaar']);
  });

  it('filtert op een caloriegrens per portie', () => {
    // Licht is 40 kcal per portie, zwaar ruim 340.
    expect(filter({ maxKcal: 100 })).toEqual(['licht']);
  });

  it('filtert op eiwit per portie', () => {
    expect(filter({ minProtein: 0.5 })).toEqual(['licht', 'zwaar']);
    expect(filter({ minProtein: 5 })).toEqual([]);
  });

  it('laat een recept vallen waarvan te weinig bekend is', () => {
    // Liever een recept missen dan een grens trekken op een half getal.
    const onbekend = makeRecipe({
      id: 'onbekend',
      title: 'Onbekend',
      ingredients: [{ amount: 100, unit: 'g', ingredientId: 'ei' }],
    });
    expect(matchesNutrition(onbekend, { maxKcal: 5000, minProtein: null }, bibliotheek)).toBe(
      false,
    );
    expect(coverage(recipeNutrition(onbekend, bibliotheek))).toBeLessThan(BETROUWBAAR_VANAF);
  });
});
