import { DATA_PATHS } from '../../config';
import type { Allergen, Difficulty, Method } from '../../domain/schema/enums';
import type { Recipe, RecipeSource, Scaling } from '../../domain/schema/recipe';
import { recipeSchema } from '../../domain/schema/recipe';
import { parseAmount } from '../../domain/text/parse';
import type { Unit } from '../../domain/units/units';

/**
 * Het formulier werkt met tekstvelden, niet met getallen: wie "1," typt is nog
 * niet klaar met typen. Pas bij opslaan wordt alles omgezet en gevalideerd.
 */

export interface DraftIngredient {
  key: string;
  amount: string;
  unit: Unit | '';
  ingredientId?: string;
  name: string;
  note: string;
  scales: Scaling;
  optional: boolean;
}

export interface DraftStep {
  key: string;
  text: string;
  timer: string;
  ovenTemp: string;
}

export interface RecipeDraft {
  id: string;
  title: string;
  description: string;
  image: string;
  prep: string;
  active: string;
  passive: string;
  methods: Method[];
  difficulty: Difficulty;
  pans: string;
  servings: string;
  ingredients: DraftIngredient[];
  steps: DraftStep[];
  tags: string[];
  season: number[];
  allergens: Allergen[];
  source: RecipeSource | undefined;
  notes: string;
  createdAt: string;
}

let teller = 0;
export const nieuweSleutel = (): string => `r${Date.now().toString(36)}${(teller += 1)}`;

export const legeIngredient = (): DraftIngredient => ({
  key: nieuweSleutel(),
  amount: '',
  unit: '',
  name: '',
  note: '',
  scales: 'linear',
  optional: false,
});

export const legeStap = (): DraftStep => ({
  key: nieuweSleutel(),
  text: '',
  timer: '',
  ovenTemp: '',
});

/** Van titel naar bestandsnaam: alleen kleine letters, cijfers en streepjes. */
export const slugify = (titel: string): string =>
  titel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const emptyDraft = (servings: number): RecipeDraft => ({
  id: '',
  title: '',
  description: '',
  image: '',
  prep: '',
  active: '',
  passive: '',
  methods: [],
  difficulty: 'makkelijk',
  pans: '1',
  servings: String(servings),
  ingredients: [legeIngredient()],
  steps: [legeStap()],
  tags: [],
  season: [],
  allergens: [],
  source: undefined,
  notes: '',
  createdAt: '',
});

const getalOfLeeg = (waarde: number | undefined): string =>
  waarde === undefined ? '' : String(waarde);

export const draftFromRecipe = (recipe: Recipe): RecipeDraft => ({
  id: recipe.id,
  title: recipe.title,
  description: recipe.description,
  image: recipe.image ?? '',
  prep: String(recipe.times.prep),
  active: String(recipe.times.active),
  passive: String(recipe.times.passive),
  methods: [...recipe.methods],
  difficulty: recipe.difficulty,
  pans: String(recipe.pans),
  servings: String(recipe.servings),
  ingredients: recipe.ingredients.map((line) => ({
    key: nieuweSleutel(),
    amount: getalOfLeeg(line.amount).replace('.', ','),
    unit: line.unit ?? '',
    ...(line.ingredientId ? { ingredientId: line.ingredientId } : {}),
    name: line.name ?? '',
    note: line.note ?? '',
    scales: line.scales,
    optional: line.optional,
  })),
  steps: recipe.steps.map((step) => ({
    key: nieuweSleutel(),
    text: step.text,
    timer: step.timer ? String(Math.round(step.timer / 60)) : '',
    ovenTemp: getalOfLeeg(step.ovenTemp),
  })),
  tags: [...recipe.tags],
  season: [...recipe.season],
  allergens: [...recipe.allergens],
  source: recipe.source,
  notes: recipe.notes ?? '',
  createdAt: recipe.createdAt,
});

const getal = (waarde: string): number | undefined => {
  const schoon = waarde.trim();
  return schoon ? parseAmount(schoon) : undefined;
};

export interface DraftResult {
  recipe?: Recipe;
  errors: string[];
}

/** De timer staat in het formulier in minuten, in het bestand in seconden. */
export const draftToRecipe = (draft: RecipeDraft): DraftResult => {
  const nu = new Date().toISOString();
  const kandidaat = {
    id: draft.id || slugify(draft.title),
    title: draft.title.trim(),
    description: draft.description.trim(),
    ...(draft.image ? { image: draft.image } : {}),
    times: {
      prep: getal(draft.prep) ?? 0,
      active: getal(draft.active) ?? 0,
      passive: getal(draft.passive) ?? 0,
    },
    methods: draft.methods,
    difficulty: draft.difficulty,
    pans: getal(draft.pans) ?? 1,
    servings: getal(draft.servings) ?? 4,
    ingredients: draft.ingredients
      .filter((regel) => regel.name.trim() || regel.ingredientId)
      .map((regel) => {
        const hoeveelheid = getal(regel.amount);
        const heeftMaat = hoeveelheid !== undefined && regel.unit !== '';
        return {
          ...(heeftMaat ? { amount: hoeveelheid, unit: regel.unit } : {}),
          ...(regel.ingredientId ? { ingredientId: regel.ingredientId } : {}),
          ...(regel.ingredientId ? {} : { name: regel.name.trim() }),
          ...(regel.note.trim() ? { note: regel.note.trim() } : {}),
          scales: regel.scales,
          optional: regel.optional,
        };
      }),
    steps: draft.steps
      .filter((stap) => stap.text.trim())
      .map((stap) => {
        const minuten = getal(stap.timer);
        const temperatuur = getal(stap.ovenTemp);
        return {
          text: stap.text.trim(),
          ...(minuten ? { timer: Math.round(minuten * 60) } : {}),
          ...(temperatuur ? { ovenTemp: Math.round(temperatuur) } : {}),
        };
      }),
    tags: draft.tags,
    season: draft.season,
    allergens: draft.allergens,
    ...(draft.source ? { source: draft.source } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    createdAt: draft.createdAt || nu,
    updatedAt: nu,
  };

  const uitkomst = recipeSchema.safeParse(kandidaat);
  if (uitkomst.success) return { recipe: uitkomst.data, errors: [] };
  return {
    errors: uitkomst.error.issues.map(
      (issue) => `${issue.path.join('.') || 'recept'}: ${issue.message}`,
    ),
  };
};

export const imagePathFor = (id: string): string => `${DATA_PATHS.assets}/recipes/${id}.webp`;
