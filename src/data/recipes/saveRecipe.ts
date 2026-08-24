import { DATA_PATHS } from '../../config';
import type { Ingredient } from '../../domain/schema/ingredient';
import { ingredientFileSchema } from '../../domain/schema/ingredient';
import type { Recipe } from '../../domain/schema/recipe';
import { readAllFiles, writeFiles } from '../db/idb';
import { commitMessages, deleteFile, fetchFileSha, writeBinaryFile, writeTextFile } from '../github/write';
import { ingredientsToYaml, recipeToYaml } from '../serialize/recipeYaml';
import { parseYaml } from '../serialize/yaml';

/**
 * Eén opslagactie kan meerdere bestanden raken: nieuwe ingrediënten, een foto en
 * het recept zelf. De volgorde is niet willekeurig. Het recept gaat als laatste,
 * zodat het nooit verwijst naar een ingrediënt of een foto die er nog niet is.
 */

export interface SavePayload {
  recipe: Recipe;
  /** Ingrediënten die nog niet in de bibliotheek staan. */
  newIngredients: Ingredient[];
  image?: { bytes: number[]; path: string } | undefined;
  mode: 'create' | 'update';
}

export interface SaveResult {
  commitUrl: string;
}

const recipePath = (id: string): string => `${DATA_PATHS.recipes}/${id}.yaml`;
const ingredientPath = (category: string): string => `${DATA_PATHS.ingredients}/${category}.yaml`;

/** De kopregels met commentaar bovenaan een bibliotheekbestand blijven staan. */
const leadingComment = (text: string): string => {
  const regels: string[] = [];
  for (const regel of text.split('\n')) {
    if (regel.startsWith('#')) regels.push(regel);
    else break;
  }
  return regels.join('\n');
};

const cacheFile = async (path: string, text: string, sha: string): Promise<void> => {
  await writeFiles([{ path, text, sha }], []);
};

/** Voegt nieuwe ingrediënten toe aan het bestand van hun categorie. */
const saveIngredients = async (ingredients: Ingredient[], token: string): Promise<void> => {
  const perCategorie = new Map<string, Ingredient[]>();
  for (const ingredient of ingredients) {
    perCategorie.set(ingredient.category, [
      ...(perCategorie.get(ingredient.category) ?? []),
      ingredient,
    ]);
  }

  const lokaal = new Map((await readAllFiles()).map((file) => [file.path, file]));

  for (const [categorie, nieuwe] of perCategorie) {
    const path = ingredientPath(categorie);
    const bestaand = lokaal.get(path);
    const huidige = bestaand ? ingredientFileSchema.parse(parseYaml(bestaand.text)) : [];
    const bekend = new Set(huidige.map((i) => i.id));
    const samen = [...huidige, ...nieuwe.filter((i) => !bekend.has(i.id))];
    const tekst = ingredientsToYaml(samen, bestaand ? leadingComment(bestaand.text) : undefined);
    const sha = bestaand?.sha ?? (await fetchFileSha(path, token));
    const resultaat = await writeTextFile({
      path,
      text: tekst,
      message: commitMessages.ingredientsUpdated(nieuwe.map((i) => i.name)),
      sha,
      token,
    });
    await cacheFile(path, tekst, resultaat.sha);
  }
};

export const saveRecipe = async (payload: SavePayload, token: string): Promise<SaveResult> => {
  if (payload.newIngredients.length > 0) {
    await saveIngredients(payload.newIngredients, token);
  }

  if (payload.image) {
    await writeBinaryFile({
      path: payload.image.path,
      bytes: Uint8Array.from(payload.image.bytes),
      message: commitMessages.imageAdded(payload.recipe.title),
      token,
    });
  }

  const path = recipePath(payload.recipe.id);
  const tekst = recipeToYaml(payload.recipe);
  const lokaal = (await readAllFiles()).find((file) => file.path === path);
  // Bij bijwerken moet de sha mee, bij aanmaken juist niet: dan weigert GitHub
  // het bestand als het al bestaat, en dat is precies de gewenste waarschuwing.
  const sha = payload.mode === 'update' ? (lokaal?.sha ?? (await fetchFileSha(path, token))) : undefined;

  const resultaat = await writeTextFile({
    path,
    text: tekst,
    message:
      payload.mode === 'create'
        ? commitMessages.recipeAdded(payload.recipe.title)
        : commitMessages.recipeUpdated(payload.recipe.title),
    sha,
    token,
  });
  await cacheFile(path, tekst, resultaat.sha);

  return { commitUrl: resultaat.commitUrl };
};

export const removeRecipe = async (recipe: Recipe, token: string): Promise<void> => {
  const path = recipePath(recipe.id);
  const lokaal = (await readAllFiles()).find((file) => file.path === path);
  const sha = lokaal?.sha ?? (await fetchFileSha(path, token));
  if (!sha) throw new Error('Dit recept staat niet (meer) in de repo.');
  await deleteFile({
    path,
    message: commitMessages.recipeDeleted(recipe.title),
    sha,
    token,
  });
  await writeFiles([], [path]);
};
