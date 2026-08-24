import { ingredientSchema, type Ingredient } from '../schema/ingredient';
import { recipeSchema, type Recipe, type RecipeInput } from '../schema/recipe';
import { createLibrary } from '../ingredients/library';

/** Kleine bibliotheek met precies de randgevallen die de tests nodig hebben. */
export const testIngredients: Ingredient[] = [
  {
    id: 'ui',
    name: 'ui',
    plural: 'uien',
    synonyms: ['gele ui', 'uitje'],
    nameEn: 'onion',
    category: 'groente-en-fruit',
    defaultUnit: 'stuks',
    conversions: { stuks: { g: 150 } },
    allergens: [],
  },
  {
    id: 'knoflook',
    name: 'knoflook',
    synonyms: ['knoflookteen', 'teentje knoflook'],
    category: 'groente-en-fruit',
    defaultUnit: 'teentje',
    conversions: { teentje: { g: 5 } },
    allergens: [],
  },
  {
    id: 'olijfolie',
    name: 'olijfolie',
    synonyms: [],
    category: 'houdbaar',
    defaultUnit: 'el',
    conversions: {},
    allergens: [],
  },
  {
    id: 'slagroom',
    name: 'slagroom',
    synonyms: ['room'],
    category: 'zuivel',
    defaultUnit: 'ml',
    conversions: {},
    packaging: { amount: 250, unit: 'ml' },
    allergens: ['melk'],
  },
  {
    id: 'ei',
    name: 'ei',
    plural: 'eieren',
    synonyms: [],
    category: 'zuivel',
    defaultUnit: 'stuks',
    conversions: { stuks: { g: 55 } },
    allergens: ['ei'],
  },
  {
    id: 'laurierblad',
    name: 'laurierblad',
    plural: 'laurierblaadjes',
    synonyms: ['laurier'],
    category: 'kruiden',
    defaultUnit: 'stuks',
    conversions: {},
    allergens: [],
  },
  {
    id: 'peper',
    name: 'zwarte peper',
    synonyms: ['peper'],
    category: 'kruiden',
    defaultUnit: 'snufje',
    conversions: {},
    allergens: [],
  },
  {
    id: 'zout',
    name: 'zout',
    synonyms: [],
    category: 'kruiden',
    defaultUnit: 'snufje',
    conversions: {},
    allergens: [],
  },
].map((raw) => ingredientSchema.parse(raw));

export const testLibrary = createLibrary(testIngredients);

type RecipeDraft = Partial<RecipeInput> & Pick<RecipeInput, 'id' | 'title'>;

/** Maakt een geldig recept met zinnige standaardwaarden. */
export const makeRecipe = (draft: RecipeDraft): Recipe =>
  recipeSchema.parse({
    description: 'Testrecept',
    times: { prep: 10, active: 20, passive: 0 },
    methods: ['koken'],
    difficulty: 'makkelijk',
    pans: 1,
    servings: 4,
    ingredients: [{ amount: 1, unit: 'stuks', ingredientId: 'ui' }],
    steps: [{ text: 'Doe iets.' }],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...draft,
  });
