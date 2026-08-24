import { useEffect, useState } from 'react';

/**
 * Houdt het scherm aan tijdens het koken. Zonder dit valt je telefoon na een
 * halve minuut in slaap en sta je met natte handen te vegen om te zien wat de
 * volgende stap was.
 *
 * De browser geeft de vergrendeling vanzelf op zodra je naar een andere app
 * gaat, dus hij wordt opnieuw aangevraagd zodra je terugkomt.
 */
export type WakeLockState = 'uit' | 'aan' | 'niet-ondersteund' | 'geweigerd';

/** Vaste eigenschap van de browser, dus geen state maar een gegeven. */
const ondersteund = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

export const useWakeLock = (active: boolean): WakeLockState => {
  const [state, setState] = useState<WakeLockState>(ondersteund ? 'uit' : 'niet-ondersteund');

  useEffect(() => {
    if (!active || !ondersteund) return;

    let sentinel: WakeLockSentinel | null = null;
    let gestopt = false;

    const vraagAan = async () => {
      if (gestopt || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        setState('aan');
        sentinel.addEventListener('release', () => {
          if (!gestopt) setState('uit');
        });
      } catch {
        // Gebeurt onder andere bij een laag accupercentage.
        setState('geweigerd');
      }
    };

    const bijTerugkeer = () => {
      if (document.visibilityState === 'visible') void vraagAan();
    };

    void vraagAan();
    document.addEventListener('visibilitychange', bijTerugkeer);

    return () => {
      gestopt = true;
      document.removeEventListener('visibilitychange', bijTerugkeer);
      void sentinel?.release().catch(() => undefined);
      setState('uit');
    };
  }, [active]);

  return state;
};
