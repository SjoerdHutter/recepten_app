import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { emptyDataset, type Dataset } from '../data/dataset';
import { loadDataset, syncData, lastSyncedAt as leesLaatsteSync } from '../data/sync/syncEngine';
import { createLibrary, type IngredientLibrary } from '../domain/ingredients/library';
import { useSettings } from './settings';

/** Niet vaker dan eens per vijf minuten vanzelf synchroniseren. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface DataValue {
  dataset: Dataset;
  library: IngredientLibrary;
  loading: boolean;
  syncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  online: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useSettings();
  const [dataset, setDataset] = useState<Dataset>(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const laatstePoging = useRef(0);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncError(null);
      return;
    }
    laatstePoging.current = Date.now();
    setSyncing(true);
    setSyncError(null);
    try {
      const uitkomst = await syncData({ token: token || undefined });
      if (uitkomst.dataset) setDataset(uitkomst.dataset);
      setLastSyncedAt(uitkomst.syncedAt);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Synchroniseren mislukt.');
    } finally {
      setSyncing(false);
    }
  }, [token]);

  // Eerst tonen wat er lokaal staat, daarna pas het netwerk aanspreken.
  useEffect(() => {
    let afgebroken = false;
    void (async () => {
      const lokaal = await loadDataset();
      if (afgebroken) return;
      setDataset(lokaal);
      setLoading(false);
      setLastSyncedAt((await leesLaatsteSync()) ?? null);
      void refresh();
    })();
    return () => {
      afgebroken = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const bijTerugkeer = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - laatstePoging.current < SYNC_INTERVAL_MS) return;
      void refresh();
    };
    const bijOnline = () => {
      setOnline(true);
      void refresh();
    };
    const bijOffline = () => setOnline(false);
    document.addEventListener('visibilitychange', bijTerugkeer);
    window.addEventListener('online', bijOnline);
    window.addEventListener('offline', bijOffline);
    return () => {
      document.removeEventListener('visibilitychange', bijTerugkeer);
      window.removeEventListener('online', bijOnline);
      window.removeEventListener('offline', bijOffline);
    };
  }, [refresh]);

  const library = useMemo(() => createLibrary(dataset.ingredients), [dataset.ingredients]);

  const value = useMemo<DataValue>(
    () => ({ dataset, library, loading, syncing, syncError, lastSyncedAt, online, refresh }),
    [dataset, library, loading, syncing, syncError, lastSyncedAt, online, refresh],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataValue => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData buiten DataProvider gebruikt');
  return context;
};

/** Eén recept opzoeken; undefined als het (nog) niet bestaat. */
export const useRecipe = (id: string | undefined) => {
  const { dataset } = useData();
  return useMemo(() => dataset.recipes.find((recipe) => recipe.id === id), [dataset.recipes, id]);
};
