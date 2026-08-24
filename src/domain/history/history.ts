import type { Recipe } from '../schema/recipe';
import { daysBetween, type DateKey } from '../planner/week';

/**
 * Kookgeschiedenis: wanneer je iets maakte, wat je ervan vond en wat je de
 * volgende keer anders wilt. Puur lokaal, want dit gaat over jouw avonden en
 * niet over het recept.
 */

export interface CookEntry {
  id: string;
  recipeId: string;
  /** De dag waarop je het maakte. */
  cookedAt: DateKey;
  servings: number;
  /** 1 tot 5; ontbreekt als je niets invulde. */
  rating?: number;
  note?: string;
}

export type History = CookEntry[];

export const nextId = (): string =>
  `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface RecipeHistory {
  entries: CookEntry[];
  /** Meest recente eerst. */
  lastCooked: DateKey | undefined;
  timesCooked: number;
  /** Gemiddelde beoordeling over de keren dat je er een gaf. */
  averageRating: number | undefined;
}

export const historyFor = (history: History, recipeId: string): RecipeHistory => {
  const entries = history
    .filter((entry) => entry.recipeId === recipeId)
    .sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  const beoordelingen = entries
    .map((entry) => entry.rating)
    .filter((waarde): waarde is number => typeof waarde === 'number');
  return {
    entries,
    lastCooked: entries[0]?.cookedAt,
    timesCooked: entries.length,
    averageRating:
      beoordelingen.length > 0
        ? beoordelingen.reduce((som, waarde) => som + waarde, 0) / beoordelingen.length
        : undefined,
  };
};

/** Binnen hoeveel dagen iets "recent gekookt" heet. */
export const RECENT_DAGEN = 14;

export const cookedRecently = (
  history: History,
  recipeId: string,
  vandaag: DateKey,
  binnenDagen = RECENT_DAGEN,
): number | undefined => {
  const laatst = historyFor(history, recipeId).lastCooked;
  if (!laatst) return undefined;
  const geleden = daysBetween(laatst, vandaag);
  return geleden >= 0 && geleden <= binnenDagen ? geleden : undefined;
};

/**
 * Kiest een willekeurig recept, maar laat wat je net gekookt hebt lichter wegen.
 * Niet uitsluiten: soms wíl je die stamppot voor de tweede keer deze maand. Een
 * gerecht van gisteren maakt alleen veel minder kans dan een dat je een half
 * jaar niet at.
 */
export const pickSurprise = (
  recipes: Recipe[],
  history: History,
  vandaag: DateKey,
  random: () => number = Math.random,
): Recipe | undefined => {
  if (recipes.length === 0) return undefined;

  const gewichten = recipes.map((recipe) => {
    const geleden = cookedRecently(history, recipe.id, vandaag);
    if (geleden === undefined) return 1;
    // Gisteren gekookt weegt 0,1; twee weken geleden bijna weer vol mee.
    return 0.1 + 0.9 * (geleden / RECENT_DAGEN);
  });

  const totaal = gewichten.reduce((som, gewicht) => som + gewicht, 0);
  let trekking = random() * totaal;
  for (let i = 0; i < recipes.length; i++) {
    trekking -= gewichten[i] ?? 0;
    if (trekking <= 0) return recipes[i];
  }
  return recipes[recipes.length - 1];
};

/** De laatste keren dat je kookte, ongeacht welk recept. */
export const recentEntries = (history: History, limiet = 30): CookEntry[] =>
  [...history].sort((a, b) => b.cookedAt.localeCompare(a.cookedAt)).slice(0, limiet);
