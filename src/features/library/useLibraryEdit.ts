import { useCallback, useMemo, useState } from 'react';
import { applyLibraryEdit, describeEdit } from '../../data/ingredients/applyEdit';
import type { LibraryEdit, LibraryState } from '../../domain/ingredients/edits';
import { useData } from '../../state/data';
import { useSettings } from '../../state/settings';

export interface EditStatus {
  busy: boolean;
  error: string | null;
  /** Bevestiging in beeld nadat er gecommit is. */
  success: string | null;
  commitUrl: string | null;
}

const RUST: EditStatus = { busy: false, error: null, success: null, commitUrl: null };

/**
 * Voert een bewerking op de bibliotheek uit: eerst de zuivere functie, dan de
 * commit, dan opnieuw synchroniseren. De foutafhandeling zit hier, zodat elk
 * scherm dat een bewerking aanbiedt dezelfde meldingen geeft.
 */
export const useLibraryEdit = () => {
  const { token, canWrite } = useSettings();
  const { dataset, refresh } = useData();
  const [status, setStatus] = useState<EditStatus>(RUST);

  const state = useMemo<LibraryState>(
    () => ({ ingredients: dataset.ingredients, recipes: dataset.recipes }),
    [dataset.ingredients, dataset.recipes],
  );

  const apply = useCallback(
    async (maak: (state: LibraryState) => LibraryEdit): Promise<boolean> => {
      if (!canWrite || !token) {
        setStatus({
          ...RUST,
          error:
            'Dit gaat niet in leesmodus. Vul een token met schrijfrechten in bij Instellingen.',
        });
        return false;
      }

      let bewerking: LibraryEdit;
      try {
        // De zuivere functie weigert bijvoorbeeld het verwijderen van iets dat
        // nog gebruikt wordt; die melding is voor jou bedoeld.
        bewerking = maak(state);
      } catch (error) {
        setStatus({
          ...RUST,
          error: error instanceof Error ? error.message : 'Deze bewerking kan niet.',
        });
        return false;
      }

      setStatus({ ...RUST, busy: true });
      try {
        const { commitUrl } = await applyLibraryEdit(bewerking, token);
        await refresh();
        setStatus({
          busy: false,
          error: null,
          success: `${bewerking.summary} (${describeEdit(bewerking)} gewijzigd).`,
          commitUrl,
        });
        return true;
      } catch (error) {
        setStatus({
          ...RUST,
          error: error instanceof Error ? error.message : 'Opslaan mislukt.',
        });
        return false;
      }
    },
    [canWrite, token, state, refresh],
  );

  const reset = useCallback(() => setStatus(RUST), []);

  return { state, apply, status, reset, canWrite };
};
