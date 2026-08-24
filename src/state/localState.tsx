import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { kvGet, kvSet } from '../data/db/idb';
import type { Pantry, PantryItem } from '../domain/pantry/pantry';
import type { Category } from '../domain/schema/enums';
import type { ManualItem } from '../domain/shopping/aggregate';
import type { Unit } from '../domain/units/units';

/**
 * Alles wat alleen op dit toestel bestaat: de selectie, de afvinkstatus en de
 * losse items. Staat in IndexedDB en gaat mee in de export.
 */

export interface SelectionEntry {
  recipeId: string;
  servings: number;
}

export const LOCAL_KEYS = {
  selection: 'selectie',
  manual: 'lijst.losseItems',
  checked: 'lijst.afgevinkt',
  pantry: 'voorraad',
  subtractPantry: 'lijst.voorraadAftrekken',
} as const;

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let afgebroken = false;
    void kvGet<T>(key)
      .then((opgeslagen) => {
        if (!afgebroken && opgeslagen !== undefined) setValue(opgeslagen);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!afgebroken) setReady(true);
      });
    return () => {
      afgebroken = true;
    };
  }, [key]);

  useEffect(() => {
    // Pas wegschrijven nadat er gelezen is, anders overschrijft de beginwaarde
    // wat er al stond.
    if (ready) void kvSet(key, value).catch(() => undefined);
  }, [key, value, ready]);

  return [value, setValue, ready] as const;
}

export interface PantryPatch {
  amount?: number | undefined;
  unit?: Unit | undefined;
  bestBefore?: string | undefined;
}

/**
 * Lege velden er weer uit halen. Zonder dit blijft er `amount: undefined` in de
 * opslag achter zodra je een hoeveelheid weer weghaalt, en dat leest terug als
 * "er staat een hoeveelheid".
 */
const schoon = (item: PantryItem): PantryItem => {
  const uit: PantryItem = { ingredientId: item.ingredientId, addedAt: item.addedAt };
  if (item.amount !== undefined && item.unit) {
    uit.amount = item.amount;
    uit.unit = item.unit;
  }
  if (item.bestBefore) uit.bestBefore = item.bestBefore;
  return uit;
};

interface LocalValue {
  selection: SelectionEntry[];
  manualItems: ManualItem[];
  checked: Record<string, boolean>;
  pantry: Pantry;
  /** Of de boodschappenlijst rekening houdt met de voorraadkast. */
  subtractPantry: boolean;
  ready: boolean;
  hasInPantry: (ingredientId: string) => boolean;
  addToPantry: (ingredientId: string, patch?: PantryPatch) => void;
  updatePantryItem: (ingredientId: string, patch: PantryPatch) => void;
  removeFromPantry: (ingredientId: string) => void;
  togglePantry: (ingredientId: string) => void;
  setSubtractPantry: (waarde: boolean) => void;
  isSelected: (recipeId: string) => boolean;
  toggleSelection: (recipeId: string, servings: number) => void;
  setServings: (recipeId: string, servings: number) => void;
  removeFromSelection: (recipeId: string) => void;
  clearSelection: () => void;
  toggleChecked: (key: string) => void;
  clearChecked: () => void;
  addManualItem: (text: string, category: Category) => void;
  removeManualItem: (id: string) => void;
}

const LocalContext = createContext<LocalValue | null>(null);

export const LocalStateProvider = ({ children }: { children: ReactNode }) => {
  const [selection, setSelection, selectionReady] = usePersistentState<SelectionEntry[]>(
    LOCAL_KEYS.selection,
    [],
  );
  const [manualItems, setManualItems, manualReady] = usePersistentState<ManualItem[]>(
    LOCAL_KEYS.manual,
    [],
  );
  const [checked, setChecked, checkedReady] = usePersistentState<Record<string, boolean>>(
    LOCAL_KEYS.checked,
    {},
  );
  const [pantry, setPantry, pantryReady] = usePersistentState<Pantry>(LOCAL_KEYS.pantry, []);
  const [subtractPantry, setSubtractPantry, subtractReady] = usePersistentState<boolean>(
    LOCAL_KEYS.subtractPantry,
    true,
  );

  const isSelected = useCallback(
    (recipeId: string) => selection.some((entry) => entry.recipeId === recipeId),
    [selection],
  );

  const hasInPantry = useCallback(
    (ingredientId: string) => pantry.some((item) => item.ingredientId === ingredientId),
    [pantry],
  );

  const value = useMemo<LocalValue>(
    () => ({
      selection,
      manualItems,
      checked,
      pantry,
      subtractPantry,
      ready: selectionReady && manualReady && checkedReady && pantryReady && subtractReady,
      isSelected,
      hasInPantry,
      setSubtractPantry,
      addToPantry(ingredientId, patch) {
        setPantry((huidig) =>
          huidig.some((item) => item.ingredientId === ingredientId)
            ? // Al in huis: alleen aanvullen wat er meegegeven wordt.
              huidig.map((item) =>
                item.ingredientId === ingredientId ? schoon({ ...item, ...patch }) : item,
              )
            : [...huidig, schoon({ ingredientId, addedAt: new Date().toISOString(), ...patch })],
        );
      },
      updatePantryItem(ingredientId, patch) {
        setPantry((huidig) =>
          huidig.map((item) =>
            item.ingredientId === ingredientId ? schoon({ ...item, ...patch }) : item,
          ),
        );
      },
      removeFromPantry(ingredientId) {
        setPantry((huidig) => huidig.filter((item) => item.ingredientId !== ingredientId));
      },
      togglePantry(ingredientId) {
        setPantry((huidig) =>
          huidig.some((item) => item.ingredientId === ingredientId)
            ? huidig.filter((item) => item.ingredientId !== ingredientId)
            : [...huidig, { ingredientId, addedAt: new Date().toISOString() }],
        );
      },
      toggleSelection(recipeId, servings) {
        setSelection((huidig) =>
          huidig.some((entry) => entry.recipeId === recipeId)
            ? huidig.filter((entry) => entry.recipeId !== recipeId)
            : [...huidig, { recipeId, servings }],
        );
      },
      setServings(recipeId, servings) {
        setSelection((huidig) =>
          huidig.map((entry) => (entry.recipeId === recipeId ? { ...entry, servings } : entry)),
        );
      },
      removeFromSelection(recipeId) {
        setSelection((huidig) => huidig.filter((entry) => entry.recipeId !== recipeId));
      },
      clearSelection() {
        setSelection([]);
      },
      toggleChecked(key) {
        setChecked((huidig) => ({ ...huidig, [key]: !huidig[key] }));
      },
      clearChecked() {
        setChecked({});
      },
      addManualItem(text, category) {
        const schoon = text.trim();
        if (!schoon) return;
        setManualItems((huidig) => [
          ...huidig,
          { id: `${Date.now().toString(36)}-${huidig.length}`, text: schoon, category },
        ]);
      },
      removeManualItem(id) {
        setManualItems((huidig) => huidig.filter((item) => item.id !== id));
      },
    }),
    [
      selection,
      manualItems,
      checked,
      pantry,
      subtractPantry,
      selectionReady,
      manualReady,
      checkedReady,
      pantryReady,
      subtractReady,
      isSelected,
      hasInPantry,
      setSelection,
      setManualItems,
      setChecked,
      setPantry,
      setSubtractPantry,
    ],
  );

  return <LocalContext.Provider value={value}>{children}</LocalContext.Provider>;
};

export const useLocalState = (): LocalValue => {
  const context = useContext(LocalContext);
  if (!context) throw new Error('useLocalState buiten LocalStateProvider gebruikt');
  return context;
};
