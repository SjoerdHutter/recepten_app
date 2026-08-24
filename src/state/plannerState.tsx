import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  historyFor,
  nextId as nextHistoryId,
  type CookEntry,
  type History,
} from '../domain/history/history';
import { moveEntry, nextId as nextPlanId, type Plan, type PlanEntry } from '../domain/planner/plan';
import { toKey, type DateKey } from '../domain/planner/week';
import type { Category } from '../domain/schema/enums';
import { usePersistentState } from './persistent';

/**
 * Wat je kookte, wat je van plan bent en wat je lekker vond. Alles per toestel
 * en in IndexedDB, want dit gaat over jouw avonden en niet over de recepten
 * zelf. Het gaat mee in de back-up.
 */

/** Een bewaarde boodschappenlijst, als momentopname van de regels. */
export interface ArchivedList {
  id: string;
  createdAt: string;
  label: string;
  recipeTitles: string[];
  lines: Array<{ label: string; quantity: string | null; category: Category }>;
}

export const PLANNER_KEYS = {
  history: 'geschiedenis',
  favorites: 'favorieten',
  plan: 'weekplan',
  archive: 'lijst.archief',
  overrides: 'recept.aanpassingen',
} as const;

/**
 * Hoeveelheden die jij voor jezelf hebt bijgesteld, per recept en per regel,
 * uitgedrukt op het basisaantal personen van het recept. Ze staan los van het
 * receptbestand: pas als je zegt dat het altijd zo moet, gaat het de repo in.
 */
export type AmountOverrides = Record<string, Record<number, number>>;

interface PlannerValue {
  history: History;
  favorites: string[];
  plan: Plan;
  archive: ArchivedList[];
  overrides: AmountOverrides;
  ready: boolean;
  overridesFor: (recipeId: string) => Record<number, number>;
  setOverride: (recipeId: string, lineIndex: number, amount: number) => void;
  clearOverride: (recipeId: string, lineIndex: number) => void;
  clearRecipeOverrides: (recipeId: string) => void;

  logCooked: (entry: Omit<CookEntry, 'id'>) => void;
  updateCookEntry: (id: string, patch: Partial<Omit<CookEntry, 'id'>>) => void;
  removeCookEntry: (id: string) => void;
  lastCookedOn: (recipeId: string) => DateKey | undefined;

  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;

  addToPlan: (recipeId: string, date: DateKey, servings: number) => void;
  removeFromPlan: (id: string) => void;
  movePlanEntry: (id: string, date: DateKey) => void;
  setPlanServings: (id: string, servings: number) => void;
  toggleExtraDay: (id: string, date: DateKey) => void;
  clearWeek: (dagen: DateKey[]) => void;

  archiveList: (lijst: Omit<ArchivedList, 'id' | 'createdAt'>) => void;
  removeArchived: (id: string) => void;
}

const PlannerContext = createContext<PlannerValue | null>(null);

export const PlannerProvider = ({ children }: { children: ReactNode }) => {
  const [history, setHistory, historyReady] = usePersistentState<History>(PLANNER_KEYS.history, []);
  const [favorites, setFavorites, favReady] = usePersistentState<string[]>(
    PLANNER_KEYS.favorites,
    [],
  );
  const [plan, setPlan, planReady] = usePersistentState<Plan>(PLANNER_KEYS.plan, []);
  const [archive, setArchive, archiveReady] = usePersistentState<ArchivedList[]>(
    PLANNER_KEYS.archive,
    [],
  );
  const [overrides, setOverrides, overridesReady] = usePersistentState<AmountOverrides>(
    PLANNER_KEYS.overrides,
    {},
  );

  const isFavorite = useCallback((recipeId: string) => favorites.includes(recipeId), [favorites]);

  const overridesFor = useCallback((recipeId: string) => overrides[recipeId] ?? {}, [overrides]);

  const lastCookedOn = useCallback(
    (recipeId: string) => historyFor(history, recipeId).lastCooked,
    [history],
  );

  const value = useMemo<PlannerValue>(
    () => ({
      history,
      favorites,
      plan,
      archive,
      overrides,
      ready: historyReady && favReady && planReady && archiveReady && overridesReady,
      isFavorite,
      lastCookedOn,
      overridesFor,

      setOverride(recipeId, lineIndex, amount) {
        setOverrides((huidig) => ({
          ...huidig,
          [recipeId]: { ...(huidig[recipeId] ?? {}), [lineIndex]: amount },
        }));
      },
      clearOverride(recipeId, lineIndex) {
        setOverrides((huidig) => {
          const voorRecept = { ...(huidig[recipeId] ?? {}) };
          delete voorRecept[lineIndex];
          if (Object.keys(voorRecept).length === 0) {
            const { [recipeId]: _weg, ...rest } = huidig;
            return rest;
          }
          return { ...huidig, [recipeId]: voorRecept };
        });
      },
      clearRecipeOverrides(recipeId) {
        setOverrides((huidig) => {
          const { [recipeId]: _weg, ...rest } = huidig;
          return rest;
        });
      },

      logCooked(entry) {
        setHistory((huidig) => [...huidig, { ...entry, id: nextHistoryId() }]);
      },
      updateCookEntry(id, patch) {
        setHistory((huidig) =>
          huidig.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
        );
      },
      removeCookEntry(id) {
        setHistory((huidig) => huidig.filter((entry) => entry.id !== id));
      },

      toggleFavorite(recipeId) {
        setFavorites((huidig) =>
          huidig.includes(recipeId)
            ? huidig.filter((id) => id !== recipeId)
            : [...huidig, recipeId],
        );
      },

      addToPlan(recipeId, date, servings) {
        const nieuw: PlanEntry = { id: nextPlanId(), recipeId, date, servings, alsoEatenOn: [] };
        setPlan((huidig) => [...huidig, nieuw]);
      },
      removeFromPlan(id) {
        setPlan((huidig) => huidig.filter((entry) => entry.id !== id));
      },
      movePlanEntry(id, date) {
        setPlan((huidig) => moveEntry(huidig, id, date));
      },
      setPlanServings(id, servings) {
        setPlan((huidig) =>
          huidig.map((entry) => (entry.id === id ? { ...entry, servings } : entry)),
        );
      },
      toggleExtraDay(id, date) {
        setPlan((huidig) =>
          huidig.map((entry) => {
            if (entry.id !== id) return entry;
            // De kookdag zelf kan geen extra eetdag zijn.
            if (date === entry.date) return entry;
            return {
              ...entry,
              alsoEatenOn: entry.alsoEatenOn.includes(date)
                ? entry.alsoEatenOn.filter((dag) => dag !== date)
                : [...entry.alsoEatenOn, date].sort(),
            };
          }),
        );
      },
      clearWeek(dagen) {
        const binnen = new Set(dagen);
        setPlan((huidig) => huidig.filter((entry) => !binnen.has(entry.date)));
      },

      archiveList(lijst) {
        setArchive((huidig) =>
          [
            {
              ...lijst,
              id: `l${Date.now().toString(36)}`,
              createdAt: new Date().toISOString(),
            },
            ...huidig,
            // Twintig lijsten is ruim een half jaar boodschappen; daarna mag de
            // oudste weg in plaats van eindeloos aangroeien.
          ].slice(0, 20),
        );
      },
      removeArchived(id) {
        setArchive((huidig) => huidig.filter((lijst) => lijst.id !== id));
      },
    }),
    [
      history,
      favorites,
      plan,
      archive,
      overrides,
      historyReady,
      favReady,
      planReady,
      archiveReady,
      overridesReady,
      isFavorite,
      lastCookedOn,
      overridesFor,
      setHistory,
      setFavorites,
      setPlan,
      setArchive,
      setOverrides,
    ],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
};

export const usePlanner = (): PlannerValue => {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner buiten PlannerProvider gebruikt');
  return context;
};

/** Vandaag als yyyy-mm-dd, op één plek zodat schermen het niet los uitrekenen. */
export const today = (): DateKey => toKey(new Date());
