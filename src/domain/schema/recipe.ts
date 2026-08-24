import { z } from 'zod';
import {
  allergenSchema,
  dateSchema,
  difficultySchema,
  methodSchema,
  slugSchema,
  unitSchema,
} from './enums';

/**
 * Een ingrediëntregel verwijst naar de bibliotheek. `name` is de vangnetnaam
 * voor een regel die (nog) niet gekoppeld is: de app dwingt bij opslaan een
 * koppeling af, maar een met de hand op github.com toegevoegde regel mag blijven
 * staan en verschijnt later in het opruimscherm.
 */
export const recipeIngredientSchema = z
  .object({
    amount: z.number().positive(),
    unit: unitSchema,
    ingredientId: slugSchema.optional(),
    name: z.string().min(1).optional(),
    /** Vrije toelichting: "fijngesneden", "op kamertemperatuur". */
    note: z.string().optional(),
    /** Laurierblad of een bakblik schaalt niet mee met het aantal personen. */
    scales: z.boolean().default(true),
    optional: z.boolean().default(false),
    /** Bij welke stap dit ingrediënt hoort (1-gebaseerd), voor de kookmodus. */
    step: z.number().int().positive().optional(),
  })
  .refine((line) => Boolean(line.ingredientId ?? line.name), {
    message: 'een ingrediëntregel heeft een ingredientId of een name nodig',
  });

export const recipeStepSchema = z.object({
  text: z.string().min(1),
  /** Duur in seconden, voor de timers in de kookmodus. */
  timer: z.number().int().positive().optional(),
  ovenTemp: z.number().int().min(0).max(300).optional(),
});

export const recipeSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1) }),
  z.object({
    type: z.literal('book'),
    title: z.string().min(1),
    page: z.number().int().optional(),
  }),
  z.object({ type: z.literal('url'), url: z.string().url(), title: z.string().optional() }),
]);

/**
 * Het onderscheid tussen actieve en passieve tijd is het belangrijkste veld van
 * het hele model: drie uur stoven waarvan twintig minuten werk is iets heel
 * anders dan drie uur aan het fornuis.
 */
export const recipeTimesSchema = z.object({
  prep: z.number().int().min(0),
  active: z.number().int().min(0),
  passive: z.number().int().min(0),
});

export const recipeSchema = z.object({
  id: slugSchema,
  title: z.string().min(1),
  description: z.string().default(''),
  /** Pad in de repo, bijvoorbeeld data/assets/recipes/stoofpot.webp */
  image: z.string().optional(),
  times: recipeTimesSchema,
  methods: z.array(methodSchema).min(1),
  difficulty: difficultySchema,
  /** Aantal pannen of schalen dat je nodig hebt, oftewel de afwas. */
  pans: z.number().int().min(0).default(1),
  /** Aantal personen waarop de hoeveelheden hieronder gebaseerd zijn. */
  servings: z.number().int().min(1),
  ingredients: z.array(recipeIngredientSchema).min(1),
  steps: z.array(recipeStepSchema).min(1),
  tags: z.array(z.string()).default([]),
  /** Maanden (1-12) waarin het gerecht op zijn best is; leeg betekent het hele jaar. */
  season: z.array(z.number().int().min(1).max(12)).default([]),
  allergens: z.array(allergenSchema).default([]),
  source: recipeSourceSchema.optional(),
  notes: z.string().optional(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeSource = z.infer<typeof recipeSourceSchema>;
export type RecipeTimes = z.infer<typeof recipeTimesSchema>;

/** Wat je in de app invult voordat het een geldig recept is. */
export type RecipeInput = z.input<typeof recipeSchema>;

/**
 * Totale tijd is afgeleid en staat daarom niet in het bestand: anders zou hij
 * kunnen gaan afwijken van de drie waarden waaruit hij volgt.
 */
export const totalMinutes = (times: RecipeTimes): number =>
  times.prep + times.active + times.passive;

/** De tijd die je er echt bij moet staan. */
export const activeMinutes = (times: RecipeTimes): number => times.prep + times.active;

export const RECIPE_FIELD_ORDER = [
  'id',
  'title',
  'description',
  'image',
  'times',
  'methods',
  'difficulty',
  'pans',
  'servings',
  'ingredients',
  'steps',
  'tags',
  'season',
  'allergens',
  'source',
  'notes',
  'createdAt',
  'updatedAt',
] as const;
