import {
  ALLERGENS,
  DIFFICULTIES,
  METHODS,
  type Allergen,
  type Difficulty,
  type Method,
} from '../schema/enums';
import { EMPTY_FILTERS, type FilterState } from './filter';

/**
 * De filters staan in de URL. Daardoor werkt de terugknop zoals je verwacht en
 * kun je een gefilterde lijst als link delen.
 */

const lijst = (value: string | null): string[] =>
  value
    ? value
        .split(',')
        .map((deel) => deel.trim())
        .filter(Boolean)
    : [];

const getal = (value: string | null): number | null => {
  if (!value) return null;
  const nummer = Number(value);
  return Number.isFinite(nummer) && nummer > 0 ? nummer : null;
};

export const filtersToParams = (filters: FilterState): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.maxTotal !== null) params.set('tot', String(filters.maxTotal));
  if (filters.maxActive !== null) params.set('act', String(filters.maxActive));
  if (filters.methods.length) params.set('bereiding', filters.methods.join(','));
  if (filters.difficulties.length) params.set('niveau', filters.difficulties.join(','));
  if (filters.includeIngredients.length) params.set('met', filters.includeIngredients.join(','));
  if (filters.excludeIngredients.length) params.set('zonder', filters.excludeIngredients.join(','));
  if (filters.tags.length) params.set('tags', filters.tags.join(','));
  if (filters.excludeAllergens.length) params.set('allergie', filters.excludeAllergens.join(','));
  if (filters.seasonOnly) params.set('seizoen', '1');
  return params;
};

export const filtersFromParams = (params: URLSearchParams): FilterState => ({
  ...EMPTY_FILTERS,
  query: params.get('q') ?? '',
  maxTotal: getal(params.get('tot')),
  maxActive: getal(params.get('act')),
  methods: lijst(params.get('bereiding')).filter((m): m is Method =>
    (METHODS as readonly string[]).includes(m),
  ),
  difficulties: lijst(params.get('niveau')).filter((d): d is Difficulty =>
    (DIFFICULTIES as readonly string[]).includes(d),
  ),
  includeIngredients: lijst(params.get('met')),
  excludeIngredients: lijst(params.get('zonder')),
  tags: lijst(params.get('tags')),
  excludeAllergens: lijst(params.get('allergie')).filter((a): a is Allergen =>
    (ALLERGENS as readonly string[]).includes(a),
  ),
  seasonOnly: params.get('seizoen') === '1',
});
