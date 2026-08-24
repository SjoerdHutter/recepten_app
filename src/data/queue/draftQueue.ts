import { deleteDraft, putDraft, readDrafts } from '../db/idb';
import { ConflictError } from '../github/write';
import { saveRecipe, type SavePayload } from '../recipes/saveRecipe';

/**
 * Zonder bereik wordt een recept lokaal bewaard en zodra er weer verbinding is
 * vanzelf gecommit. Zonder wachtrij zou je in de supermarkt of op de camping een
 * recept kunnen invoeren dat vervolgens verdwijnt.
 */

export interface QueuedDraft {
  id: string;
  payload: SavePayload;
  queuedAt: string;
  error?: string;
}

export const enqueueDraft = async (payload: SavePayload): Promise<void> => {
  await putDraft({ id: payload.recipe.id, payload, queuedAt: new Date().toISOString() });
};

export const listDrafts = async (): Promise<QueuedDraft[]> =>
  (await readDrafts()).map((draft) => ({
    id: draft.id,
    payload: draft.payload as SavePayload,
    queuedAt: draft.queuedAt,
    ...(draft.error ? { error: draft.error } : {}),
  }));

export const removeDraft = deleteDraft;

export interface FlushResult {
  saved: number;
  failed: number;
  remaining: number;
}

/**
 * Probeert de wachtrij leeg te werken. Een botsing op de sha blijft staan met een
 * melding erbij: die moet jij oplossen. Een netwerkfout stopt de ronde, want dan
 * heeft doorgaan geen zin.
 */
export const flushQueue = async (token: string): Promise<FlushResult> => {
  const wachtrij = await listDrafts();
  let saved = 0;
  let failed = 0;

  for (const draft of wachtrij) {
    try {
      await saveRecipe(draft.payload, token);
      await deleteDraft(draft.id);
      saved += 1;
    } catch (error) {
      if (error instanceof ConflictError) {
        await putDraft({
          id: draft.id,
          payload: draft.payload,
          queuedAt: draft.queuedAt,
          error: error.message,
        });
        failed += 1;
        continue;
      }
      // Waarschijnlijk geen verbinding; de rest volgt een volgende keer.
      break;
    }
  }

  const rest = await readDrafts();
  return { saved, failed, remaining: rest.length };
};
