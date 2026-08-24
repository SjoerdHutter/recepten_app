import { useEffect, useState } from 'react';
import { kvGet, kvSet } from '../data/db/idb';

/**
 * State die in IndexedDB blijft staan. Alles wat alleen op dit toestel bestaat
 * gebruikt dit: de selectie, de voorraadkast, het weekplan, de geschiedenis.
 *
 * De `ready`-vlag is niet optioneel maar noodzakelijk: zonder die vlag zou de
 * beginwaarde meteen weggeschreven worden en daarmee wissen wat er al stond,
 * nog voordat het gelezen is.
 */
export function usePersistentState<T>(key: string, initial: T) {
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
    if (ready) void kvSet(key, value).catch(() => undefined);
  }, [key, value, ready]);

  return [value, setValue, ready] as const;
}
