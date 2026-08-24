import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, countActiveFilters, filterRecipes, isInSeason } from './filter';
import { makeRecipe, testLibrary } from '../testing/fixtures';

const snel = makeRecipe({
  id: 'snelle-pasta',
  title: 'Snelle pasta',
  times: { prep: 5, active: 10, passive: 0 },
  methods: ['koken'],
  difficulty: 'makkelijk',
  tags: ['vegetarisch', 'snel'],
  allergens: ['gluten'],
  ingredients: [{ amount: 1, unit: 'stuks', ingredientId: 'ui' }],
});

const stoof = makeRecipe({
  id: 'stoofpot',
  title: 'Stoofpot met bier',
  times: { prep: 20, active: 25, passive: 180 },
  methods: ['stoven', 'oven'],
  difficulty: 'gemiddeld',
  season: [11, 12, 1],
  allergens: ['gluten', 'melk'],
  ingredients: [
    { amount: 2, unit: 'stuks', ingredientId: 'ui' },
    { amount: 100, unit: 'ml', ingredientId: 'slagroom' },
  ],
});

const taart = makeRecipe({
  id: 'appeltaart',
  title: 'Appeltaart',
  times: { prep: 30, active: 15, passive: 60 },
  methods: ['oven', 'bakken'],
  difficulty: 'uitdagend',
  season: [9, 10],
  allergens: ['gluten', 'ei', 'melk'],
  ingredients: [{ amount: 3, unit: 'stuks', ingredientId: 'ei' }],
});

const alle = [snel, stoof, taart];
const context = { library: testLibrary, month: 12 };
const filter = (patch: Partial<typeof EMPTY_FILTERS>) =>
  filterRecipes(alle, { ...EMPTY_FILTERS, ...patch }, context).map((r) => r.id);

describe('filters', () => {
  it('geeft zonder filters alles terug', () => {
    expect(filter({})).toHaveLength(3);
  });

  it('filtert op maximale totale tijd', () => {
    expect(filter({ maxTotal: 60 })).toEqual(['snelle-pasta']);
  });

  it('onderscheidt actieve tijd van totale tijd', () => {
    // De stoofpot duurt ruim drie uur, maar kost maar 45 minuten werk: hij
    // overleeft een filter op actieve tijd en sneuvelt op totale tijd.
    expect(filter({ maxActive: 45 })).toContain('stoofpot');
    expect(filter({ maxTotal: 100 })).toEqual(['snelle-pasta']);
    expect(filter({ maxActive: 30 })).toEqual(['snelle-pasta']);
  });

  it('filtert op meerdere bereidingswijzen tegelijk', () => {
    expect(filter({ methods: ['oven'] })).toEqual(['stoofpot', 'appeltaart']);
    expect(filter({ methods: ['koken', 'bakken'] })).toEqual(['snelle-pasta', 'appeltaart']);
  });

  it('filtert op moeilijkheidsgraad', () => {
    expect(filter({ difficulties: ['makkelijk', 'uitdagend'] })).toEqual([
      'snelle-pasta',
      'appeltaart',
    ]);
  });

  it('filtert op wel en niet bevatten van ingrediënten', () => {
    expect(filter({ includeIngredients: ['ui'] })).toEqual(['snelle-pasta', 'stoofpot']);
    expect(filter({ excludeIngredients: ['ui'] })).toEqual(['appeltaart']);
    expect(filter({ includeIngredients: ['ui', 'slagroom'] })).toEqual(['stoofpot']);
  });

  it('sluit allergenen hard uit', () => {
    expect(filter({ excludeAllergens: ['ei'] })).toEqual(['snelle-pasta', 'stoofpot']);
    expect(filter({ excludeAllergens: ['gluten'] })).toEqual([]);
  });

  it('filtert op vrije tags', () => {
    expect(filter({ tags: ['vegetarisch'] })).toEqual(['snelle-pasta']);
  });

  it('zoekt in titel, tags en ingrediëntnamen', () => {
    expect(filter({ query: 'bier' })).toEqual(['stoofpot']);
    expect(filter({ query: 'slagroom' })).toEqual(['stoofpot']);
    expect(filter({ query: 'snel' })).toEqual(['snelle-pasta']);
    expect(filter({ query: 'APPEL' })).toEqual(['appeltaart']);
  });

  it('combineert filters', () => {
    expect(filter({ methods: ['oven'], maxActive: 45, excludeAllergens: ['ei'] })).toEqual([
      'stoofpot',
    ]);
  });

  it('kijkt bij "nu in seizoen" naar de huidige maand', () => {
    expect(filter({ seasonOnly: true })).toEqual(['snelle-pasta', 'stoofpot']);
    expect(
      filterRecipes(alle, { ...EMPTY_FILTERS, seasonOnly: true }, { ...context, month: 9 }).map(
        (r) => r.id,
      ),
    ).toEqual(['snelle-pasta', 'appeltaart']);
  });

  it('rekent een recept zonder seizoen het hele jaar mee', () => {
    expect(isInSeason(snel, 3)).toBe(true);
    expect(isInSeason(taart, 3)).toBe(false);
  });

  it('telt hoeveel filters er aan staan', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, methods: ['oven'], maxTotal: 30, seasonOnly: true }),
    ).toBe(3);
  });
});
