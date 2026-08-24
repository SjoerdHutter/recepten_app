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
import { kvGet, kvSet } from '../data/db/idb';

/**
 * Kooktimers.
 *
 * Elke timer bewaart zijn absolute eindtijd, niet hoeveel er nog te gaan is.
 * Dat is het hele punt: een telefoon bevriest of vertraagt JavaScript zodra het
 * scherm uitgaat of je naar een andere app wisselt, dus aftellen met een
 * interval loopt gegarandeerd achter. Door bij elke tik opnieuw naar de klok te
 * kijken klopt de tijd altijd, ook als de app twintig minuten weg is geweest.
 *
 * Ze staan in IndexedDB, dus ze overleven ook een herstart van de app.
 */

export interface Timer {
  id: string;
  label: string;
  recipeId?: string;
  stepIndex?: number;
  /** Epoch-milliseconden waarop hij afloopt. */
  endsAt: number;
  durationSeconds: number;
  /** Waar zodra hij afgelopen is en je hem nog niet hebt weggeklikt. */
  ringing: boolean;
}

const OPSLAG_SLEUTEL = 'timers';

export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied';

interface TimerValue {
  timers: Timer[];
  /** Tikt mee, zodat de aftelling opnieuw tekent. */
  now: number;
  ringing: Timer[];
  start: (options: {
    seconds: number;
    label: string;
    recipeId?: string;
    stepIndex?: number;
  }) => void;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
  extend: (id: string, minutes: number) => void;
  notificationState: NotificationState;
  requestNotifications: () => Promise<void>;
}

const TimerContext = createContext<TimerValue | null>(null);

/**
 * Een korte pieptoon uit de Web Audio API. Een geluidsbestand zou meegebakken
 * en gecachet moeten worden voor iets wat in drie regels kan.
 */
const maakAlarm = () => {
  let context: AudioContext | null = null;

  const zorgVoorContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const Klasse =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Klasse) return null;
    context ??= new Klasse();
    return context;
  };

  return {
    /** Aanroepen tijdens een tik van de gebruiker; anders weigert de browser geluid. */
    ontgrendel() {
      const ctx = zorgVoorContext();
      if (ctx?.state === 'suspended') void ctx.resume();
    },
    speel() {
      const ctx = zorgVoorContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const start = ctx.currentTime;
      // Drie korte piepjes; hard genoeg om boven een afzuigkap uit te komen.
      for (let i = 0; i < 3; i++) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        const van = start + i * 0.45;
        gain.gain.setValueAtTime(0.0001, van);
        gain.gain.exponentialRampToValueAtTime(0.35, van + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, van + 0.32);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(van);
        oscillator.stop(van + 0.35);
      }
    },
  };
};

const alarm = maakAlarm();

const leesNotificatieStand = (): NotificationState =>
  typeof Notification === 'undefined'
    ? 'unsupported'
    : (Notification.permission as NotificationState);

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [geladen, setGeladen] = useState(false);
  const [notificationState, setNotificationState] =
    useState<NotificationState>(leesNotificatieStand);
  // Welke timers al hebben gerinkeld, zodat het alarm niet elke tik opnieuw gaat.
  const gemeld = useRef(new Set<string>());

  useEffect(() => {
    let afgebroken = false;
    void kvGet<Timer[]>(OPSLAG_SLEUTEL)
      .then((opgeslagen) => {
        if (afgebroken || !opgeslagen) return;
        // Alles wat verliep terwijl de app dicht was, is al gebeurd: die hoeven
        // niet alsnog te gaan piepen, maar wel te blijven staan als melding.
        for (const timer of opgeslagen) {
          if (timer.endsAt <= Date.now()) gemeld.current.add(timer.id);
        }
        setTimers(opgeslagen.map((t) => (t.endsAt <= Date.now() ? { ...t, ringing: true } : t)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!afgebroken) setGeladen(true);
      });
    return () => {
      afgebroken = true;
    };
  }, []);

  useEffect(() => {
    if (geladen) void kvSet(OPSLAG_SLEUTEL, timers).catch(() => undefined);
  }, [timers, geladen]);

  const meld = useCallback((timer: Timer) => {
    alarm.speel();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Wekker', { body: timer.label, tag: timer.id, requireInteraction: true });
      } catch {
        /* Sommige browsers staan dit alleen vanuit een service worker toe. */
      }
    }
    if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200, 100, 200]);
  }, []);

  // De hartslag. Ook als de browser hem vertraagt naar eens per minuut blijft de
  // uitkomst kloppen, want er wordt telkens opnieuw naar de klok gekeken.
  useEffect(() => {
    if (timers.length === 0) return;
    const tik = () => {
      const nu = Date.now();
      setNow(nu);
      setTimers((huidig) => {
        let veranderd = false;
        const bijgewerkt = huidig.map((timer) => {
          if (timer.ringing || timer.endsAt > nu) return timer;
          veranderd = true;
          if (!gemeld.current.has(timer.id)) {
            gemeld.current.add(timer.id);
            meld(timer);
          }
          return { ...timer, ringing: true };
        });
        return veranderd ? bijgewerkt : huidig;
      });
    };
    tik();
    const interval = window.setInterval(tik, 500);
    // Terugkomen na een tijd weg: meteen bijwerken in plaats van wachten op de
    // volgende tik.
    const bijTerugkeer = () => {
      if (document.visibilityState === 'visible') tik();
    };
    document.addEventListener('visibilitychange', bijTerugkeer);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', bijTerugkeer);
    };
  }, [timers.length, meld]);

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const uitkomst = await Notification.requestPermission();
      setNotificationState(uitkomst as NotificationState);
    } catch {
      /* geweigerd of niet ondersteund */
    }
  }, []);

  const value = useMemo<TimerValue>(
    () => ({
      timers,
      now,
      ringing: timers.filter((timer) => timer.ringing),
      notificationState,
      requestNotifications,
      start({ seconds, label, recipeId, stepIndex }) {
        // Dit gebeurt tijdens een tik van de gebruiker: hét moment om geluid
        // aan te mogen zetten.
        alarm.ontgrendel();
        const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        setTimers((huidig) => [
          ...huidig,
          {
            id,
            label,
            ...(recipeId ? { recipeId } : {}),
            ...(stepIndex !== undefined ? { stepIndex } : {}),
            endsAt: Date.now() + seconds * 1000,
            durationSeconds: seconds,
            ringing: false,
          },
        ]);
      },
      cancel(id) {
        gemeld.current.delete(id);
        setTimers((huidig) => huidig.filter((timer) => timer.id !== id));
      },
      dismiss(id) {
        gemeld.current.delete(id);
        setTimers((huidig) => huidig.filter((timer) => timer.id !== id));
      },
      extend(id, minutes) {
        gemeld.current.delete(id);
        setTimers((huidig) =>
          huidig.map((timer) =>
            timer.id === id
              ? {
                  ...timer,
                  // Vanaf nu doortellen, niet vanaf de oude eindtijd: je drukt
                  // hierop omdat het nóg even nodig heeft.
                  endsAt: Date.now() + minutes * 60_000,
                  ringing: false,
                }
              : timer,
          ),
        );
      },
    }),
    [timers, now, notificationState, requestNotifications],
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
};

export const useTimers = (): TimerValue => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimers buiten TimerProvider gebruikt');
  return context;
};

/** Resterende seconden; nul zodra hij afgelopen is. */
export const remainingSeconds = (timer: Timer, now: number): number =>
  Math.max(0, Math.round((timer.endsAt - now) / 1000));
