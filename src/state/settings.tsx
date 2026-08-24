import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { checkToken } from '../data/github/client';

/**
 * Het token staat in localStorage. Dat is een bewuste afweging voor persoonlijk
 * gebruik op een eigen toestel: er is geen backend om het veilig te bewaren, en
 * de schade blijft beperkt tot deze ene repo. Zie de README.
 */
const TOKEN_KEY = 'recepten.token';
const THEME_KEY = 'recepten.theme';
const SERVINGS_KEY = 'recepten.defaultServings';

export type Theme = 'system' | 'light' | 'dark';
export type TokenState = 'geen' | 'controleren' | 'schrijven' | 'alleen-lezen' | 'fout';

const lees = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const schrijf = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* privémodus: dan onthouden we het deze sessie alleen in het geheugen */
  }
};

interface SettingsValue {
  token: string;
  tokenState: TokenState;
  tokenError: string | null;
  canWrite: boolean;
  theme: Theme;
  defaultServings: number;
  saveToken: (token: string) => void;
  clearToken: () => void;
  setTheme: (theme: Theme) => void;
  setDefaultServings: (servings: number) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

const applyTheme = (theme: Theme): void => {
  const donker =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', donker);
  document.documentElement.style.colorScheme = donker ? 'dark' : 'light';
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState(() => lees(TOKEN_KEY) ?? '');
  const [tokenState, setTokenState] = useState<TokenState>(() =>
    lees(TOKEN_KEY) ? 'controleren' : 'geen',
  );
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(
    () => (lees(THEME_KEY) as Theme | null) ?? 'system',
  );
  const [defaultServings, setDefaultServingsState] = useState(() =>
    Number(lees(SERVINGS_KEY) ?? '4'),
  );

  // De systeeminstelling blijft leidend zolang je niets forceert.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const luister = () => applyTheme('system');
    media.addEventListener('change', luister);
    return () => media.removeEventListener('change', luister);
  }, [theme]);

  // Het token controleren is een gesprek met een systeem buiten React: de
  // status wordt daarom pas in het antwoord gezet, niet in de effect-body.
  useEffect(() => {
    if (!token) return;
    let afgebroken = false;
    checkToken(token).then(
      ({ canWrite }) => {
        if (afgebroken) return;
        setTokenState(canWrite ? 'schrijven' : 'alleen-lezen');
        setTokenError(null);
      },
      (error: unknown) => {
        if (afgebroken) return;
        setTokenState('fout');
        setTokenError(error instanceof Error ? error.message : 'Onbekende fout.');
      },
    );
    return () => {
      afgebroken = true;
    };
  }, [token]);

  const value = useMemo<SettingsValue>(
    () => ({
      token,
      tokenState,
      tokenError,
      canWrite: tokenState === 'schrijven',
      theme,
      defaultServings,
      saveToken(nieuw) {
        const opgeschoond = nieuw.trim();
        schrijf(TOKEN_KEY, opgeschoond || null);
        setTokenState(opgeschoond ? 'controleren' : 'geen');
        setTokenError(null);
        // De effect hierboven doet de controle zodra het token verandert.
        setToken(opgeschoond);
      },
      clearToken() {
        setToken('');
        schrijf(TOKEN_KEY, null);
        setTokenState('geen');
        setTokenError(null);
      },
      setTheme(nieuw) {
        setThemeState(nieuw);
        schrijf(THEME_KEY, nieuw);
      },
      setDefaultServings(aantal) {
        setDefaultServingsState(aantal);
        schrijf(SERVINGS_KEY, String(aantal));
      },
    }),
    [token, tokenState, tokenError, theme, defaultServings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsValue => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings buiten SettingsProvider gebruikt');
  return context;
};
