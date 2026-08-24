import { DATA_PATHS, REPO, rawUrl } from '../../config';
import { githubJson, githubText } from './client';

export interface RemoteFile {
  path: string;
  /** De blob-sha van git; dezelfde sha die je bij het schrijven weer meegeeft. */
  sha: string;
  size: number;
}

interface TreeResponse {
  tree: Array<{ path: string; type: string; sha: string; size?: number }>;
  truncated: boolean;
}

export interface TreeResult {
  files: RemoteFile[];
  etag: string | null;
  /** Waar als de repo niet gewijzigd is; een 304 telt niet mee voor de limiet. */
  notModified: boolean;
}

const isDataFile = (path: string): boolean =>
  (path.startsWith(`${DATA_PATHS.recipes}/`) || path.startsWith(`${DATA_PATHS.ingredients}/`)) &&
  (path.endsWith('.yaml') || path.endsWith('.yml'));

/**
 * Eén verzoek levert het pad en de sha van elk bestand in de repo. Daarmee is
 * te zien wat er veranderd is zonder ook maar één receptbestand op te halen.
 */
export async function fetchDataTree(options: {
  token?: string | undefined;
  etag?: string | undefined;
  signal?: AbortSignal;
}): Promise<TreeResult> {
  const response = await githubJson<TreeResponse>(
    `repos/${REPO.owner}/${REPO.name}/git/trees/${REPO.branch}?recursive=1`,
    options,
  );
  if (response.notModified || !response.data) {
    return { files: [], etag: response.etag, notModified: true };
  }
  if (response.data.truncated) {
    console.warn('De bestandsboom van GitHub is afgekapt; er zijn erg veel bestanden.');
  }
  const files = response.data.tree
    .filter((entry) => entry.type === 'blob' && isDataFile(entry.path))
    .map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size ?? 0 }));
  return { files, etag: response.etag, notModified: false };
}

/**
 * Haalt de inhoud van één bestand op. Met token via de API (ruime limiet en
 * altijd actueel), zonder token via raw.githubusercontent (geen limiet, wel een
 * cache van een paar minuten).
 */
export async function fetchFileContent(
  file: RemoteFile,
  options: { token?: string | undefined; signal?: AbortSignal } = {},
): Promise<string> {
  if (options.token) {
    // Opvragen op sha in plaats van op pad: die inhoud verandert nooit meer.
    return githubText(`repos/${REPO.owner}/${REPO.name}/git/blobs/${file.sha}`, options);
  }
  const response = await fetch(rawUrl(file.path), { signal: options.signal ?? null });
  if (!response.ok) {
    throw new Error(`Kon ${file.path} niet ophalen (${response.status}).`);
  }
  return response.text();
}
