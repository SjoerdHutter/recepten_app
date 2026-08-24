import { buildDataset, emptyDataset, type Dataset } from '../dataset';
import { fetchDataTree, fetchFileContent } from '../github/tree';
import { bundledFiles } from '../snapshot';
import { kvGet, kvSet, readAllFiles, writeFiles, type CachedFile } from '../db/idb';
import { gitBlobSha } from './sha';

const ETAG_KEY = 'sync.treeEtag';
const SYNCED_AT_KEY = 'sync.lastSyncedAt';

/** Hooguit een handvol verzoeken tegelijk; een telefoon op 4G verslikt zich anders. */
const mapWithLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (item !== undefined) results[current] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
};

/**
 * Bij de allereerste start staat de cache leeg. Dan worden de bestanden gebruikt
 * die met de app zijn meegeleverd, inclusief hun git-sha, zodat de eerste sync
 * alleen hoeft op te halen wat sindsdien is veranderd.
 */
export const ensureSeeded = async (): Promise<void> => {
  const bestaand = await readAllFiles();
  if (bestaand.length > 0) return;
  const geseed = await Promise.all(
    bundledFiles.map(async (file) => ({
      path: file.path,
      text: file.text,
      sha: await gitBlobSha(file.text),
    })),
  );
  await writeFiles(geseed, []);
};

/** Wat er lokaal staat, zonder het netwerk aan te raken. */
export const loadDataset = async (): Promise<Dataset> => {
  try {
    await ensureSeeded();
    return buildDataset(await readAllFiles());
  } catch (error) {
    console.warn('Lokale opslag niet beschikbaar, terugvallen op meegeleverde bestanden.', error);
    return buildDataset(bundledFiles);
  }
};

export interface SyncOutcome {
  dataset: Dataset | null;
  /** Aantal bestanden dat is opgehaald of verwijderd. */
  changed: number;
  syncedAt: string;
}

/**
 * Vergelijkt de sha's uit de repo met wat er lokaal staat en haalt alleen het
 * verschil op. Een ongewijzigde repo kost één verzoek dat met 304 wordt
 * beantwoord, en die telt niet mee voor de limiet van GitHub.
 */
export const syncData = async (options: {
  token?: string | undefined;
  signal?: AbortSignal;
}): Promise<SyncOutcome> => {
  await ensureSeeded();
  const etag = await kvGet<string>(ETAG_KEY);
  const tree = await fetchDataTree({ token: options.token, etag, signal: options.signal });
  const syncedAt = new Date().toISOString();

  if (tree.notModified) {
    await kvSet(SYNCED_AT_KEY, syncedAt);
    return { dataset: null, changed: 0, syncedAt };
  }

  const lokaal = new Map((await readAllFiles()).map((file) => [file.path, file]));
  const opHalen = tree.files.filter((file) => lokaal.get(file.path)?.sha !== file.sha);
  const opRuimen = [...lokaal.keys()].filter(
    (path) => !tree.files.some((file) => file.path === path),
  );

  const nieuw: CachedFile[] = await mapWithLimit(opHalen, 6, async (file) => ({
    path: file.path,
    sha: file.sha,
    text: await fetchFileContent(file, { token: options.token, signal: options.signal }),
  }));

  if (nieuw.length > 0 || opRuimen.length > 0) await writeFiles(nieuw, opRuimen);
  if (tree.etag) await kvSet(ETAG_KEY, tree.etag);
  await kvSet(SYNCED_AT_KEY, syncedAt);

  return {
    dataset: buildDataset(await readAllFiles()),
    changed: nieuw.length + opRuimen.length,
    syncedAt,
  };
};

export const lastSyncedAt = async (): Promise<string | undefined> => kvGet<string>(SYNCED_AT_KEY);

export const emptyData = emptyDataset;
