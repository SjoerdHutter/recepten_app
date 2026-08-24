import type { Unit } from '../units/units';

/**
 * De voorraadkast staat alleen op dit toestel, net als de selectie en de
 * afvinkstatus. Hij verandert elke dag; dat in de repo bijhouden zou een commit
 * per pak melk opleveren. Hij gaat wel mee in de export en import.
 */

export interface PantryItem {
  ingredientId: string;
  /**
   * Optioneel. Zonder hoeveelheid betekent een regel simpelweg "dit heb ik in
   * huis"; dat is vaak genoeg en scheelt invulwerk bij zout, olie en meel.
   */
  amount?: number;
  unit?: Unit;
  /** Houdbaar tot, als yyyy-mm-dd. */
  bestBefore?: string;
  addedAt: string;
}

export type Pantry = PantryItem[];

export const pantryIndex = (pantry: Pantry): Map<string, PantryItem> =>
  new Map(pantry.map((item) => [item.ingredientId, item]));

/** Aantal dagen tussen vandaag en de houdbaarheidsdatum; negatief is over. */
export const daysUntil = (bestBefore: string, today: Date): number => {
  const doel = new Date(`${bestBefore}T00:00:00`);
  if (Number.isNaN(doel.getTime())) return Number.POSITIVE_INFINITY;
  const vandaag = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((doel.getTime() - vandaag.getTime()) / (24 * 60 * 60 * 1000));
};

export interface ExpiringItem {
  item: PantryItem;
  /** Negatief als het al over de datum is. */
  days: number;
}

/**
 * Wat er bijna over is, het kortst houdbare eerst. Wat al over de datum is komt
 * er ook in: dat wil je juist als eerste zien.
 */
export const findExpiring = (pantry: Pantry, today: Date, withinDays = 5): ExpiringItem[] =>
  pantry
    .filter((item) => item.bestBefore)
    .map((item) => ({ item, days: daysUntil(item.bestBefore as string, today) }))
    .filter((entry) => entry.days <= withinDays)
    .sort((a, b) => a.days - b.days);

export const formatDays = (days: number): string => {
  if (days < -1) return `${Math.abs(days)} dagen over de datum`;
  if (days === -1) return 'sinds gisteren over de datum';
  if (days === 0) return 'vandaag over de datum';
  if (days === 1) return 'morgen over de datum';
  return `nog ${days} dagen houdbaar`;
};
