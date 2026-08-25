import { describe, expect, it } from 'vitest';
import { createLibrary } from '../ingredients/library';
import { ingredientSchema, type Ingredient } from '../schema/ingredient';
import { matchImportedName, normalizeFractions, parseImportLine } from './line';

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
  ingredient({ id: 'boter', name: 'boter', nameEn: 'butter' }),
  ingredient({ id: 'knoflook', name: 'knoflook', nameEn: 'garlic', defaultUnit: 'teentje' }),
  ingredient({ id: 'tomaat', name: 'tomaat', plural: 'tomaten', nameEn: 'tomato' }),
  ingredient({ id: 'zout', name: 'zout', nameEn: 'salt' }),
  ingredient({ id: 'peper', name: 'peper', nameEn: 'pepper' }),
  ingredient({ id: 'olijfolie', name: 'olijfolie', nameEn: 'olive oil', defaultUnit: 'ml' }),
]);

describe('normalizeFractions', () => {
  it('telt een gemengd getal op', () => {
    expect(normalizeFractions('1 1/2 cups flour')).toBe('1.5 cups flour');
  });

  it('leest een breukteken', () => {
    expect(normalizeFractions('½ tsp salt')).toBe('0.5 tsp salt');
    expect(normalizeFractions('1½ cups')).toBe('1.5 cups');
  });

  it('laat een gewoon getal met rust', () => {
    expect(normalizeFractions('200 g bloem')).toBe('200 g bloem');
  });
});

describe('parseImportLine', () => {
  it('rekent cups om naar milliliter en koppelt de Engelse naam', () => {
    expect(parseImportLine('1 1/2 cups all-purpose flour', library)).toEqual({
      amount: 360,
      unit: 'ml',
      ingredientId: 'bloem',
      name: 'bloem',
    });
  });

  it('leest een Nederlandse regel met een toelichting achter de komma', () => {
    expect(parseImportLine('2 uien, gesnipperd', library)).toEqual({
      amount: 2,
      unit: 'stuks',
      ingredientId: 'ui',
      name: 'ui',
      note: 'gesnipperd',
    });
  });

  it('rekent ounces om en rondt af op een heel getal', () => {
    const regel = parseImportLine('8 oz butter', library);
    expect(regel?.amount).toBe(227);
    expect(regel?.unit).toBe('g');
    expect(regel?.ingredientId).toBe('boter');
  });

  it('houdt een halve theelepel een halve', () => {
    expect(parseImportLine('1/2 tsp salt', library)).toEqual({
      amount: 0.5,
      unit: 'tl',
      ingredientId: 'zout',
      name: 'zout',
    });
  });

  it('maakt van "to taste" een regel zonder maat die niet meeschaalt', () => {
    expect(parseImportLine('Salt to taste', library)).toEqual({
      ingredientId: 'zout',
      name: 'zout',
      scales: 'taste',
    });
  });

  it('leest cloves als teentjes', () => {
    expect(parseImportLine('3 cloves garlic, minced', library)).toEqual({
      amount: 3,
      unit: 'teentje',
      ingredientId: 'knoflook',
      name: 'knoflook',
      note: 'minced',
    });
  });

  it('zet een hoeveelheid zonder maat op stuks', () => {
    expect(parseImportLine('2 large onions', library)).toEqual({
      amount: 2,
      unit: 'stuks',
      ingredientId: 'ui',
      name: 'ui',
    });
  });

  it('haalt de haakjes uit de naam en zet ze in de toelichting', () => {
    const regel = parseImportLine('400 g tomatoes (canned, chopped)', library);
    expect(regel?.ingredientId).toBe('tomaat');
    expect(regel?.note).toBe('canned, chopped');
    expect(regel?.amount).toBe(400);
  });

  it('laat een onbekend ingrediënt als losse naam staan', () => {
    const regel = parseImportLine('1 tbsp gochujang', library);
    expect(regel).toEqual({ amount: 1, unit: 'el', name: 'gochujang' });
  });

  it('neemt bij een bereik de ondergrens', () => {
    expect(parseImportLine('2-3 tomatoes', library)?.amount).toBe(2);
  });

  it('geeft niets terug bij een lege regel', () => {
    expect(parseImportLine('   ', library)).toBeNull();
    expect(parseImportLine('- ', library)).toBeNull();
  });
});

describe('matchImportedName', () => {
  it('vindt het ingrediënt via de Engelse naam', () => {
    expect(matchImportedName('onion', library)?.id).toBe('ui');
  });

  it('vindt het via een Engels meervoud', () => {
    expect(matchImportedName('tomatoes', library)?.id).toBe('tomaat');
  });

  it('kijkt langs de bijvoeglijke naamwoorden heen', () => {
    expect(matchImportedName('extra virgin olive oil', library)?.id).toBe('olijfolie');
  });

  it('geeft niets terug bij iets wat er echt niet in staat', () => {
    expect(matchImportedName('gochujang', library)).toBeUndefined();
  });
});
