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
import type { Category } from '../domain/schema/enums';
import type { ManualItem } from '../domain/shopping/aggregate';

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

interface LocalValue {
  selection: SelectionEntry[];
  manualItems: ManualItem[];
  checked: Record<string, boolean>;
  ready: boolean;
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

  const isSelected = useCallback(
    (recipeId: string) => selection.some((entry) => entry.recipeId === recipeId),
    [selection],
  );

  const value = useMemo<LocalValue>(
    () => ({
      selection,
      manualItems,
      checked,
      ready: selectionReady && manualReady && checkedReady,
      isSelected,
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
      selectionReady,
      manualReady,
      checkedReady,
      isSelected,
      setSelection,
      setManualItems,
      setChecked,
    ],
  );

  return <LocalContext.Provider value={value}>{children}</LocalContext.Provider>;
};

export const useLocalState = (): LocalValue => {
  const context = useContext(LocalContext);
  if (!context) throw new Error('useLocalState buiten LocalStateProvider gebruikt');
  return context;
};
