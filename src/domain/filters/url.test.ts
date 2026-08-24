import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from './filter';
import { filtersFromParams, filtersToParams } from './url';

describe('filters in de URL', () => {
  it('overleeft een rondje heen en terug', () => {
    const filters = {
      ...EMPTY_FILTERS,
      query: 'stoof',
      maxTotal: 60,
      maxActive: 30,
      methods: ['oven', 'stoven'] as const,
      difficulties: ['makkelijk'] as const,
      includeIngredients: ['ui'],
      excludeIngredients: ['knoflook'],
      tags: ['vegetarisch'],
      excludeAllergens: ['noten'] as const,
      seasonOnly: true,
    };
    expect(
      filtersFromParams(
        filtersToParams({
          ...filters,
          methods: [...filters.methods],
          difficulties: [...filters.difficulties],
          excludeAllergens: [...filters.excludeAllergens],
        }),
      ),
    ).toEqual({
      ...filters,
      methods: [...filters.methods],
      difficulties: [...filters.difficulties],
      excludeAllergens: [...filters.excludeAllergens],
    });
  });

  it('laat lege filters uit de URL weg', () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('negeert onzin uit een geplakte URL', () => {
    const filters = filtersFromParams(new URLSearchParams('bereiding=magnetron,onzin&tot=-5'));
    expect(filters.methods).toEqual(['magnetron']);
    expect(filters.maxTotal).toBeNull();
  });
});
