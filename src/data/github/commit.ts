import { REPO } from '../../config';
import { writeFiles } from '../db/idb';
import { gitBlobSha } from '../sync/sha';
import { GitHubError, githubJson } from './client';
import { ConflictError } from './write';

/**
 * Eén commit voor meerdere bestanden, via de Git Data API.
 *
 * De Contents API kan maar één bestand per commit. Voor het toevoegen van een
 * recept is dat prima, maar het samenvoegen van twee ingrediënten raakt het
 * bibliotheekbestand én elk recept dat ernaar verwees. Dat als losse commits
 * doen levert een onleesbare geschiedenis op, en erger: het kan halverwege
 * stuklopen en de data inconsistent achterlaten. Hier wordt in vier stappen een
 * nieuwe boom gebouwd en de branch in één keer doorgezet.
 */

export interface FileChange {
  path: string;
  /** De nieuwe inhoud. Laat weg om het bestand te verwijderen. */
  text?: string | undefined;
}

interface RefAntwoord {
  object: { sha: string };
}

interface CommitAntwoord {
  sha: string;
  html_url: string;
  tree: { sha: string };
}

interface TreeAntwoord {
  sha: string;
}

const basis = `repos/${REPO.owner}/${REPO.name}`;

export interface CommitResult {
  commitUrl: string;
  sha: string;
}

export const commitChanges = async (options: {
  changes: FileChange[];
  message: string;
  token: string;
}): Promise<CommitResult> => {
  const { changes, message, token } = options;
  if (changes.length === 0) throw new Error('Niets om te committen.');

  // 1. Waar staat de branch nu?
  const ref = await githubJson<RefAntwoord>(`${basis}/git/ref/heads/${REPO.branch}`, { token });
  const basisCommitSha = ref.data?.object.sha;
  if (!basisCommitSha) throw new Error('De branch kon niet gelezen worden.');

  // 2. Bij welke boom hoort die commit?
  const basisCommit = await githubJson<CommitAntwoord>(
    `${basis}/git/commits/${basisCommitSha}`,
    { token },
  );
  const basisTreeSha = basisCommit.data?.tree.sha;
  if (!basisTreeSha) throw new Error('De boom van de branch kon niet gelezen worden.');

  // 3. Een nieuwe boom, alleen met wat er verandert. GitHub vult de rest aan
  //    vanuit base_tree. Een sha van null betekent: verwijder dit bestand.
  const tree = changes.map((change) =>
    change.text === undefined
      ? { path: change.path, mode: '100644', type: 'blob', sha: null }
      : { path: change.path, mode: '100644', type: 'blob', content: change.text },
  );
  const nieuweTree = await githubJson<TreeAntwoord>(`${basis}/git/trees`, {
    method: 'POST',
    token,
    body: { base_tree: basisTreeSha, tree },
  });
  if (!nieuweTree.data?.sha) throw new Error('De nieuwe boom kon niet gemaakt worden.');

  // 4. De commit zelf.
  const commit = await githubJson<CommitAntwoord>(`${basis}/git/commits`, {
    method: 'POST',
    token,
    body: { message, tree: nieuweTree.data.sha, parents: [basisCommitSha] },
  });
  if (!commit.data?.sha) throw new Error('De commit kon niet gemaakt worden.');

  // 5. De branch doorzetten. Zonder force: is er intussen elders gepusht, dan
  //    is dit geen fast-forward en weigert GitHub, precies zoals gewenst.
  try {
    await githubJson(`${basis}/git/refs/heads/${REPO.branch}`, {
      method: 'PATCH',
      token,
      body: { sha: commit.data.sha, force: false },
    });
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 422 || error.status === 409)) {
      throw new ConflictError(REPO.branch);
    }
    throw error;
  }

  // De lokale cache bijwerken met de sha's die git zelf ook zou berekenen,
  // zodat de eerstvolgende synchronisatie niets onnodig ophaalt.
  const bijgewerkt = await Promise.all(
    changes
      .filter((change): change is { path: string; text: string } => change.text !== undefined)
      .map(async (change) => ({
        path: change.path,
        text: change.text,
        sha: await gitBlobSha(change.text),
      })),
  );
  const verwijderd = changes.filter((change) => change.text === undefined).map((c) => c.path);
  await writeFiles(bijgewerkt, verwijderd);

  return { commitUrl: commit.data.html_url, sha: commit.data.sha };
};
