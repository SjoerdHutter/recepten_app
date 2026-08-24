import { z } from 'zod';
import { UNITS } from '../units/units';
import { allergenSchema, categorySchema, dateSchema, slugSchema, unitSchema } from './enums';

/** Voedingswaarde per 100 g, met herkomst zodat duidelijk is waar het vandaan komt. */
export const nutritionSchema = z.object({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  fiber: z.number().min(0).optional(),
  salt: z.number().min(0).optional(),
  source: z.string().optional(),
  date: dateSchema.optional(),
});

export const priceSchema = z.object({
  amount: z.number().min(0),
  /** Prijs per deze eenheid, bijvoorbeeld 1,79 per kg. */
  per: unitSchema,
  date: dateSchema,
});

/**
 * De ruggengraat van de app. Zonder canonieke ingrediënten belanden "ui",
 * "uien" en "Ui" als drie regels op de boodschappenlijst.
 */
export const ingredientSchema = z.object({
  id: slugSchema,
  name: z.string().min(1),
  /** Meervoud voor de weergave: "2 uien" in plaats van "2 ui". */
  plural: z.string().optional(),
  /** Alles wat naar dit ingrediënt kan verwijzen, inclusief meervouden. */
  synonyms: z.array(z.string()).default([]),
  /** Voor het importeren van buitenlandse recepten (milestone 9). */
  nameEn: z.string().optional(),
  category: categorySchema,
  defaultUnit: unitSchema,
  /**
   * "1 <van> is <factor> <naar>", bijvoorbeeld 1 stuks ui = 150 g. Hiermee kan
   * de boodschappenlijst 2 uien en 150 g ui alsnog optellen.
   */
  conversions: z
    .partialRecord(unitSchema, z.partialRecord(unitSchema, z.number().positive()))
    .default({}),
  /** Typische verpakking in de supermarkt, voor de verpakkingsafronding (milestone 7). */
  packaging: z.object({ amount: z.number().positive(), unit: unitSchema }).optional(),
  price: priceSchema.optional(),
  allergens: z.array(allergenSchema).default([]),
  nutrition: nutritionSchema.optional(),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Nutrition = z.infer<typeof nutritionSchema>;

/** Een bestand in data/ingredients/ bevat een lijst ingrediënten van één categorie. */
export const ingredientFileSchema = z.array(ingredientSchema);

export const INGREDIENT_FIELD_ORDER = [
  'id',
  'name',
  'plural',
  'synonyms',
  'nameEn',
  'category',
  'defaultUnit',
  'conversions',
  'packaging',
  'price',
  'allergens',
  'nutrition',
] as const;

export const ALL_UNITS = UNITS;
