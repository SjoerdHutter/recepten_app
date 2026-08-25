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

/**
 * De twee optionele importmodules. Ze staan hier los van het GitHub-token,
 * want ze horen bij een andere dienst en de app verbergt ze allebei zolang ze
 * leeg zijn. Voor de API-sleutel geldt hetzelfde verhaal als voor het token:
 * localStorage, geen back-up, en uitsluitend naar het adres van die ene API.
 */
const PROXY_KEY = 'recepten.importProxy';
const AI_KEY = 'recepten.aiKey';
const AI_MODEL_KEY = 'recepten.aiModel';

export type Theme = 'system' | 'light' | 'dark';
export type TokenState = 'geen' | 'controleren' | 'schrijven' | 'alleen-lezen' | 'fout';

/**
 * De modellen die een foto van een receptpagina aankunnen. Het goedkope model
 * staat vooraan: een kookboekpagina is een paar duizend tokens, dus dit kost
 * bij persoonlijk gebruik centen per maand.
 */
export const AI_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — snel en goedkoop' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — beter bij slecht handschrift' },
] as const;

export const STANDAARD_MODEL = AI_MODELS[0].id;

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
  /** Adres van de importproxy; leeg betekent: verberg het importeren van een URL. */
  importProxy: string;
  /** API-sleutel voor het omzetten van een foto; leeg betekent: verberg die knop. */
  aiKey: string;
  aiModel: string;
  canImportUrl: boolean;
  canImportPhoto: boolean;
  saveToken: (token: string) => void;
  clearToken: () => void;
  setTheme: (theme: Theme) => void;
  setDefaultServings: (servings: number) => void;
  setImportProxy: (url: string) => void;
  setAiKey: (key: string) => void;
  setAiModel: (model: string) => void;
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
  const [importProxy, setImportProxyState] = useState(() => lees(PROXY_KEY) ?? '');
  const [aiKey, setAiKeyState] = useState(() => lees(AI_KEY) ?? '');
  const [aiModel, setAiModelState] = useState(() => lees(AI_MODEL_KEY) ?? STANDAARD_MODEL);

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
      importProxy,
      aiKey,
      aiModel,
      canImportUrl: importProxy.trim().length > 0,
      canImportPhoto: aiKey.trim().length > 0,
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
      setImportProxy(url) {
        // Een adres met een schuine streep aan het eind zou verderop een dubbele
        // slash opleveren; die haalt hij er hier één keer af.
        const opgeschoond = url.trim().replace(/\/+$/, '');
        setImportProxyState(opgeschoond);
        schrijf(PROXY_KEY, opgeschoond || null);
      },
      setAiKey(key) {
        const opgeschoond = key.trim();
        setAiKeyState(opgeschoond);
        schrijf(AI_KEY, opgeschoond || null);
      },
      setAiModel(model) {
        setAiModelState(model);
        schrijf(AI_MODEL_KEY, model);
      },
    }),
    [token, tokenState, tokenError, theme, defaultServings, importProxy, aiKey, aiModel],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsValue => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings buiten SettingsProvider gebruikt');
  return context;
};
