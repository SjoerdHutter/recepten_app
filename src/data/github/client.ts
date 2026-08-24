import { API_ORIGIN, REPO } from '../../config';

/**
 * Alle communicatie met GitHub loopt hier langs. Het token gaat uitsluitend
 * naar api.github.com: elk ander adres krijgt geen Authorization-header mee,
 * en de repo is publiek, dus dat is geen theoretische voorzorg.
 */

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** Foutmeldingen die uitleggen wat je eraan kunt doen. */
const messageFor = (status: number, detail: string): string => {
  switch (status) {
    case 401:
      return 'Het token wordt niet geaccepteerd. Controleer of het klopt en nog geldig is.';
    case 403:
      return detail.includes('rate limit')
        ? 'Te veel verzoeken aan GitHub. Probeer het over een paar minuten opnieuw, of vul een token in.'
        : 'Geen rechten voor deze actie. Heeft het token schrijfrechten op deze repo?';
    case 404:
      return 'Niet gevonden op GitHub. Klopt de naam van de repo en de branch?';
    case 409:
      return 'Het bestand is intussen elders gewijzigd.';
    case 422:
      return `GitHub weigerde de wijziging: ${detail}`;
    default:
      return status >= 500
        ? 'GitHub reageert niet. Probeer het straks opnieuw.'
        : `Onverwachte fout van GitHub (${status}).`;
  }
};

export interface GitHubRequest {
  token?: string | undefined;
  etag?: string | undefined;
  accept?: string;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export interface GitHubResponse<T> {
  data: T | null;
  etag: string | null;
  /** Waar bij een 304: er is niets veranderd sinds de vorige keer. */
  notModified: boolean;
}

const apiUrl = (path: string): URL => {
  const url = new URL(path.replace(/^\//, ''), `${API_ORIGIN}/`);
  if (url.origin !== API_ORIGIN) {
    throw new Error('Verzoeken met een token gaan uitsluitend naar api.github.com.');
  }
  return url;
};

async function request(path: string, options: GitHubRequest): Promise<Response> {
  const url = apiUrl(path);
  const headers = new Headers({
    Accept: options.accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });
  // De header wordt alleen gezet nadat hierboven is vastgesteld dat het adres
  // echt api.github.com is.
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.etag) headers.set('If-None-Match', options.etag);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  return fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal ?? null,
  });
}

export async function githubJson<T>(
  path: string,
  options: GitHubRequest = {},
): Promise<GitHubResponse<T>> {
  const response = await request(path, options);
  if (response.status === 304) return { data: null, etag: options.etag ?? null, notModified: true };
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GitHubError(messageFor(response.status, detail), response.status, detail);
  }
  return {
    data: (await response.json()) as T,
    etag: response.headers.get('ETag'),
    notModified: false,
  };
}

export async function githubText(path: string, options: GitHubRequest = {}): Promise<string> {
  const response = await request(path, { ...options, accept: 'application/vnd.github.raw' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GitHubError(messageFor(response.status, detail), response.status, detail);
  }
  return response.text();
}

/**
 * Controleert of een token werkt en of het schrijfrechten heeft op déze repo.
 * Een fine-grained token met Contents: read and write levert push: true op.
 */
export async function checkToken(token: string): Promise<{ canWrite: boolean }> {
  const repo = await githubJson<{ permissions?: { push?: boolean } }>(
    `repos/${REPO.owner}/${REPO.name}`,
    { token },
  );
  return { canWrite: repo.data?.permissions?.push === true };
}
