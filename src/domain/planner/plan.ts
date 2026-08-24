import type { Recipe } from '../schema/recipe';
import type { ShoppingSelection } from '../shopping/aggregate';
import { addDays, formatDay, dayNameShort, type DateKey } from './week';

/**
 * De weekplanner. Een gerecht staat op de dag dat je het kookt; wil je er twee
 * keer van eten, dan komen de extra dagen erbij te staan zonder dat het gerecht
 * nog een keer in de lijst verschijnt.
 *
 * Dat onderscheid is de hele reden dat dit niet gewoon "een recept per dag" is:
 * de boodschappen moeten kloppen voor twee maaltijden, maar je wilt niet twee
 * keer dezelfde stoofpot op je weekmenu zien staan.
 */

export interface PlanEntry {
  id: string;
  recipeId: string;
  /** De dag waarop je kookt. */
  date: DateKey;
  /** Aantal personen per maaltijd. */
  servings: number;
  /** Extra dagen waarop je van dezelfde pan eet. */
  alsoEatenOn: DateKey[];
}

export type Plan = PlanEntry[];

/** Alle dagen waarop dit gerecht op tafel komt, gesorteerd. */
export const mealDays = (entry: PlanEntry): DateKey[] => [entry.date, ...entry.alsoEatenOn].sort();

/** Hoeveel porties je in totaal kookt: per maaltijd maal het aantal dagen. */
export const totalServings = (entry: PlanEntry): number =>
  entry.servings * (1 + entry.alsoEatenOn.length);

/** Wat er op een bepaalde dag gegeten wordt, inclusief restjes van eerder. */
export const entriesForDay = (plan: Plan, day: DateKey): PlanEntry[] =>
  plan.filter((entry) => mealDays(entry).includes(day));

/** Kook je dit vandaag, of eet je van gisteren? */
export const isLeftoverDay = (entry: PlanEntry, day: DateKey): boolean => entry.date !== day;

/**
 * Van weekplan naar boodschappenselectie. Elk gerecht komt één keer voor, met
 * het totale aantal porties, zodat de boodschappenlijst klopt voor alle dagen
 * waarop je ervan eet.
 */
export const planToSelections = (
  plan: Plan,
  recipes: Recipe[],
  dagen: DateKey[],
): ShoppingSelection[] => {
  const binnenBereik = new Set(dagen);
  const perRecept = new Map<string, number>();

  for (const entry of plan) {
    // Kook je op zondag voor maandag, dan hoort dat gerecht bij de week waarin
    // je kookt: dan koop je het ook.
    if (!binnenBereik.has(entry.date)) continue;
    perRecept.set(entry.recipeId, (perRecept.get(entry.recipeId) ?? 0) + totalServings(entry));
  }

  const uit: ShoppingSelection[] = [];
  for (const [recipeId, servings] of perRecept) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (recipe) uit.push({ recipe, servings });
  }
  return uit.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title, 'nl'));
};

export const nextId = (): string =>
  `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Een gerecht naar een andere dag verplaatsen, met de eetdagen mee. */
export const moveEntry = (plan: Plan, id: string, naar: DateKey): Plan => {
  const entry = plan.find((item) => item.id === id);
  if (!entry) return plan;
  const verschil =
    (new Date(`${naar}T00:00:00`).getTime() - new Date(`${entry.date}T00:00:00`).getTime()) /
    86_400_000;
  return plan.map((item) =>
    item.id === id
      ? {
          ...item,
          date: naar,
          alsoEatenOn: item.alsoEatenOn.map((dag) => addDays(dag, Math.round(verschil))),
        }
      : item,
  );
};

/** Het weekmenu als platte tekst, om te delen. */
export const planToText = (
  plan: Plan,
  recipes: Recipe[],
  dagen: DateKey[],
  titel = 'Weekmenu',
): string => {
  const regels: string[] = [titel, ''];
  for (const dag of dagen) {
    const vandaag = entriesForDay(plan, dag);
    if (vandaag.length === 0) continue;
    const namen = vandaag.map((entry) => {
      const recipe = recipes.find((item) => item.id === entry.recipeId);
      const naam = recipe?.title ?? entry.recipeId;
      return isLeftoverDay(entry, dag) ? `${naam} (van ${dayNameShort(entry.date)})` : naam;
    });
    regels.push(`${formatDay(dag)}: ${namen.join(', ')}`);
  }
  return regels.length > 2 ? regels.join('\n') : `${titel}\n\nNog niets ingepland.`;
};
