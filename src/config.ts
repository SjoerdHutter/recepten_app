/**
 * Waar de gegevens staan. Deze waarden zijn openbaar: het zijn de coördinaten
 * van een publieke repo, geen geheimen.
 */
export const REPO = {
  owner: 'SjoerdHutter',
  name: 'recepten_app',
  branch: 'main',
} as const;

export const DATA_PATHS = {
  recipes: 'data/recipes',
  ingredients: 'data/ingredients',
  assets: 'data/assets',
} as const;

/** Het enige adres waar een token ooit naartoe gestuurd mag worden. */
export const API_ORIGIN = 'https://api.github.com';

/** Voor lezen zonder token: geen limiet, wel een cache van een paar minuten. */
export const RAW_ORIGIN = 'https://raw.githubusercontent.com';

export const repoSlug = `${REPO.owner}/${REPO.name}`;

/** Deeplink naar het "new file"-scherm van GitHub, voor de leesmodus. */
export const newFileUrl = (path: string, value: string): string =>
  `https://github.com/${repoSlug}/new/${REPO.branch}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(value)}`;

export const fileUrl = (path: string): string =>
  `https://github.com/${repoSlug}/blob/${REPO.branch}/${path}`;

export const rawUrl = (path: string): string =>
  `${RAW_ORIGIN}/${REPO.owner}/${REPO.name}/${REPO.branch}/${path}`;
