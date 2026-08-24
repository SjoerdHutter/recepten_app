import { DATA_PATHS } from '../../config';
import type { LibraryEdit } from '../../domain/ingredients/edits';
import type { Category } from '../../domain/schema/enums';
import { readAllFiles } from '../db/idb';
import { commitChanges, type FileChange } from '../github/commit';
import { ingredientsToYaml, recipeToYaml } from '../serialize/recipeYaml';

/**
 * Zet een bewerking uit de domeinlaag om in bestanden en commit ze in één keer.
 *
 * Samenvoegen raakt het bibliotheekbestand én elk recept dat het ingrediënt
 * gebruikte. Dat moet één commit zijn: halverwege stuklopen zou recepten
 * achterlaten die naar een ingrediënt verwijzen dat niet meer bestaat.
 */

const ingredientPath = (category: Category): string =>
  `${DATA_PATHS.ingredients}/${category}.yaml`;

/** De kopregel met commentaar bovenaan een bibliotheekbestand blijft staan. */
const leadingComment = (text: string | undefined): string | undefined => {
  if (!text) return undefined;
  const regels: string[] = [];
  for (const regel of text.split('\n')) {
    if (regel.startsWith('#')) regels.push(regel);
    else break;
  }
  return regels.length > 0 ? regels.join('\n') : undefined;
};

export const buildChanges = async (edit: LibraryEdit): Promise<FileChange[]> => {
  const lokaal = new Map((await readAllFiles()).map((file) => [file.path, file.text]));
  const changes: FileChange[] = [];

  for (const category of edit.touchedCategories) {
    const path = ingredientPath(category);
    const ingredienten = edit.state.ingredients.filter((item) => item.category === category);
    changes.push(
      ingredienten.length === 0
        ? // Het laatste ingrediënt uit een categorie weg: dan hoeft het bestand
          // er ook niet meer te zijn.
          { path }
        : { path, text: ingredientsToYaml(ingredienten, leadingComment(lokaal.get(path))) },
    );
  }

  for (const id of edit.changedRecipeIds) {
    const recept = edit.state.recipes.find((recipe) => recipe.id === id);
    if (!recept) continue;
    // updatedAt blijft bewust staan: een ingrediënt dat opnieuw gekoppeld wordt
    // is geen inhoudelijke wijziging aan het recept. Wanneer het gebeurde staat
    // in de git-geschiedenis.
    changes.push({ path: `${DATA_PATHS.recipes}/${id}.yaml`, text: recipeToYaml(recept) });
  }

  return changes;
};

export const applyLibraryEdit = async (
  edit: LibraryEdit,
  token: string,
): Promise<{ commitUrl: string }> => {
  const changes = await buildChanges(edit);
  if (changes.length === 0) throw new Error('Deze bewerking verandert geen enkel bestand.');
  const { commitUrl } = await commitChanges({ changes, message: edit.summary, token });
  return { commitUrl };
};

/** Wat er gaat gebeuren, om te tonen voordat er gecommit wordt. */
export const describeEdit = (edit: LibraryEdit): string => {
  const delen: string[] = [];
  if (edit.touchedCategories.length > 0) {
    delen.push(
      edit.touchedCategories.length === 1
        ? '1 bibliotheekbestand'
        : `${edit.touchedCategories.length} bibliotheekbestanden`,
    );
  }
  if (edit.changedRecipeIds.length > 0) {
    delen.push(
      edit.changedRecipeIds.length === 1 ? '1 recept' : `${edit.changedRecipeIds.length} recepten`,
    );
  }
  return delen.length === 0 ? 'Geen bestanden' : delen.join(' en ');
};
