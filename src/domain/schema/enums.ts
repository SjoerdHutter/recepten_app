import { z } from 'zod';
import { UNITS } from '../units/units';

export const unitSchema = z.enum(UNITS);

/** Bereidingswijzen; een recept mag er meerdere hebben. */
export const METHODS = [
  'oven',
  'koken',
  'bakken',
  'braden',
  'wok',
  'airfryer',
  'grill',
  'stoven',
  'magnetron',
  'geen bereiding',
] as const;
export type Method = (typeof METHODS)[number];
export const methodSchema = z.enum(METHODS);

export const DIFFICULTIES = ['makkelijk', 'gemiddeld', 'uitdagend'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const difficultySchema = z.enum(DIFFICULTIES);

/**
 * De volgorde hieronder is de standaard looproute door de supermarkt en bepaalt
 * de volgorde van de kopjes op de boodschappenlijst. Vanaf milestone 7 kan die
 * per winkel overschreven worden.
 */
export const CATEGORIES = [
  'groente-en-fruit',
  'brood',
  'zuivel',
  'vlees-en-vis',
  'kruiden',
  'houdbaar',
  'diepvries',
  'dranken',
  'non-food',
  'overig',
] as const;
export type Category = (typeof CATEGORIES)[number];
export const categorySchema = z.enum(CATEGORIES);

export const CATEGORY_LABELS: Record<Category, string> = {
  'groente-en-fruit': 'Groente en fruit',
  brood: 'Brood',
  zuivel: 'Zuivel',
  'vlees-en-vis': 'Vlees en vis',
  kruiden: 'Kruiden en specerijen',
  houdbaar: 'Houdbaar',
  diepvries: 'Diepvries',
  dranken: 'Dranken',
  'non-food': 'Non-food',
  overig: 'Overig',
};

/**
 * Allergenen zijn een aparte, gesloten lijst en géén vrije tag: alleen zo kan
 * de app er een harde uitsluiting van maken.
 */
export const ALLERGENS = [
  'gluten',
  'ei',
  'melk',
  'noten',
  'pinda',
  'soja',
  'vis',
  'schaaldieren',
  'weekdieren',
  'selderij',
  'mosterd',
  'sesam',
  'sulfiet',
  'lupine',
] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const allergenSchema = z.enum(ALLERGENS);

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten',
  ei: 'Ei',
  melk: 'Melk en lactose',
  noten: 'Noten',
  pinda: 'Pinda',
  soja: 'Soja',
  vis: 'Vis',
  schaaldieren: 'Schaaldieren',
  weekdieren: 'Weekdieren',
  selderij: 'Selderij',
  mosterd: 'Mosterd',
  sesam: 'Sesam',
  sulfiet: 'Sulfiet',
  lupine: 'Lupine',
};

/** Vrije tags zijn niet afgesloten, maar dit zijn de suggesties in de UI. */
export const SUGGESTED_TAGS = [
  'vegetarisch',
  'vegan',
  'glutenvrij',
  'lactosevrij',
  'notenvrij',
  'snel',
  'meal prep',
  'comfort food',
  'feestje',
] as const;

export const MONTH_LABELS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
] as const;

/** Een id is ook een bestandsnaam, dus alleen kleine letters, cijfers en streepjes. */
export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'alleen kleine letters, cijfers en koppeltekens');

/** YAML kan een datum als Date teruggeven; hier wordt het altijd een ISO-string. */
export const dateSchema = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString() : value),
  z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: 'geen geldige datum' }),
);
