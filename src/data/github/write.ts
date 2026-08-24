import { REPO } from '../../config';
import { GitHubError, githubJson } from './client';

/**
 * Schrijven gaat via de Contents API. Elke schrijfactie geeft de sha mee van het
 * bestand zoals de app het kent; klopt die niet meer, dan is het bestand elders
 * gewijzigd en weigert GitHub de schrijfactie. Dat is precies de bedoeling:
 * liever een melding dan stilletjes iemands wijziging overschrijven.
 */

export class ConflictError extends Error {
  constructor(readonly path: string) {
    super('Dit bestand is intussen ergens anders gewijzigd. Haal de nieuwste versie op en probeer opnieuw.');
    this.name = 'ConflictError';
  }
}

const contentsUrl = (path: string): string =>
  `repos/${REPO.owner}/${REPO.name}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

/** Base64 van UTF-8 tekst; btoa alleen werkt niet met accenten. */
export const encodeText = (text: string): string => encodeBytes(new TextEncoder().encode(text));

export const encodeBytes = (bytes: Uint8Array): string => {
  let binair = '';
  const blok = 0x8000;
  for (let i = 0; i < bytes.length; i += blok) {
    binair += String.fromCharCode(...bytes.subarray(i, i + blok));
  }
  return btoa(binair);
};

interface ContentsAntwoord {
  content: { sha: string; path: string } | null;
  commit: { sha: string; html_url: string };
}

export interface WriteResult {
  sha: string;
  commitUrl: string;
}

/** De sha van een bestand, of undefined als het nog niet bestaat. */
export const fetchFileSha = async (path: string, token: string): Promise<string | undefined> => {
  try {
    const antwoord = await githubJson<{ sha: string }>(`${contentsUrl(path)}?ref=${REPO.branch}`, {
      token,
    });
    return antwoord.data?.sha;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return undefined;
    throw error;
  }
};

const schrijf = async (options: {
  path: string;
  base64: string;
  message: string;
  sha?: string | undefined;
  token: string;
}): Promise<WriteResult> => {
  try {
    const antwoord = await githubJson<ContentsAntwoord>(contentsUrl(options.path), {
      method: 'PUT',
      token: options.token,
      body: {
        message: options.message,
        content: options.base64,
        branch: REPO.branch,
        ...(options.sha ? { sha: options.sha } : {}),
      },
    });
    return {
      sha: antwoord.data?.content?.sha ?? '',
      commitUrl: antwoord.data?.commit.html_url ?? '',
    };
  } catch (error) {
    // 409 is een botsing op de sha, 422 komt als het bestand al bestaat terwijl
    // er geen sha is meegegeven.
    if (error instanceof GitHubError && (error.status === 409 || error.status === 422)) {
      throw new ConflictError(options.path);
    }
    throw error;
  }
};

export const writeTextFile = (options: {
  path: string;
  text: string;
  message: string;
  sha?: string | undefined;
  token: string;
}): Promise<WriteResult> =>
  schrijf({ ...options, base64: encodeText(options.text) });

export const writeBinaryFile = (options: {
  path: string;
  bytes: Uint8Array;
  message: string;
  sha?: string | undefined;
  token: string;
}): Promise<WriteResult> => schrijf({ ...options, base64: encodeBytes(options.bytes) });

export const deleteFile = async (options: {
  path: string;
  message: string;
  sha: string;
  token: string;
}): Promise<void> => {
  try {
    await githubJson(contentsUrl(options.path), {
      method: 'DELETE',
      token: options.token,
      body: { message: options.message, sha: options.sha, branch: REPO.branch },
    });
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 409 || error.status === 422)) {
      throw new ConflictError(options.path);
    }
    throw error;
  }
};

/** Commitboodschappen op één plek, zodat de geschiedenis leesbaar blijft. */
export const commitMessages = {
  recipeAdded: (titel: string) => `Recept toegevoegd: ${titel}`,
  recipeUpdated: (titel: string) => `Recept bijgewerkt: ${titel}`,
  recipeDeleted: (titel: string) => `Recept verwijderd: ${titel}`,
  ingredientsUpdated: (namen: string[]) =>
    namen.length === 1
      ? `Ingrediënt toegevoegd: ${namen[0]}`
      : `Ingrediënten toegevoegd: ${namen.join(', ')}`,
  imageAdded: (titel: string) => `Foto toegevoegd bij ${titel}`,
};
