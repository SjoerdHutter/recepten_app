import { z } from 'zod';
import { DATA_PATHS } from '../config';
import { ingredientFileSchema, type Ingredient } from '../domain/schema/ingredient';
import { recipeSchema, type Recipe } from '../domain/schema/recipe';
import { parseYaml } from './serialize/yaml';

export interface DataProblem {
  path: string;
  message: string;
}

export interface Dataset {
  recipes: Recipe[];
  ingredients: Ingredient[];
  /** Bestanden die niet gelezen konden worden; de rest werkt gewoon door. */
  problems: DataProblem[];
}

export const emptyDataset = (): Dataset => ({ recipes: [], ingredients: [], problems: [] });

const describeIssues = (error: z.ZodError): string =>
  error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join('.') || 'bestand'}: ${issue.message}`)
    .join('; ');

export interface SourceFile {
  path: string;
  text: string;
}

/**
 * Zet ruwe bestanden om in een bruikbare verzameling. Een bestand met een fout
 * blokkeert de rest niet: het verschijnt als melding in de instellingen.
 */
export const buildDataset = (files: SourceFile[]): Dataset => {
  const recipes: Recipe[] = [];
  const ingredients: Ingredient[] = [];
  const problems: DataProblem[] = [];

  for (const file of files) {
    let raw: unknown;
    try {
      raw = parseYaml(file.text);
    } catch (error) {
      problems.push({
        path: file.path,
        message: `geen geldige YAML (${error instanceof Error ? error.message : 'onbekende fout'})`,
      });
      continue;
    }

    if (file.path.startsWith(`${DATA_PATHS.recipes}/`)) {
      const result = recipeSchema.safeParse(raw);
      if (result.success) recipes.push(result.data);
      else problems.push({ path: file.path, message: describeIssues(result.error) });
    } else if (file.path.startsWith(`${DATA_PATHS.ingredients}/`)) {
      const result = ingredientFileSchema.safeParse(raw);
      if (result.success) ingredients.push(...result.data);
      else problems.push({ path: file.path, message: describeIssues(result.error) });
    }
  }

  const dubbeleRecepten = findDuplicates(recipes.map((r) => r.id));
  for (const id of dubbeleRecepten) {
    problems.push({
      path: `${DATA_PATHS.recipes}/${id}.yaml`,
      message: 'dit id komt meerdere keren voor',
    });
  }
  const dubbeleIngredienten = findDuplicates(ingredients.map((i) => i.id));
  for (const id of dubbeleIngredienten) {
    problems.push({
      path: DATA_PATHS.ingredients,
      message: `ingrediënt "${id}" staat er meer dan één keer in`,
    });
  }

  return {
    recipes: recipes.sort((a, b) => a.title.localeCompare(b.title, 'nl')),
    ingredients,
    problems,
  };
};

const findDuplicates = (values: string[]): string[] => {
  const gezien = new Set<string>();
  const dubbel = new Set<string>();
  for (const value of values) {
    if (gezien.has(value)) dubbel.add(value);
    gezien.add(value);
  }
  return [...dubbel];
};

/** Ingrediënten waar wel naar verwezen wordt, maar die niet bestaan. */
export const findUnlinkedIngredients = (
  dataset: Dataset,
): Array<{ recipeId: string; name: string }> => {
  const bekend = new Set(dataset.ingredients.map((i) => i.id));
  const ontbreekt: Array<{ recipeId: string; name: string }> = [];
  for (const recipe of dataset.recipes) {
    for (const line of recipe.ingredients) {
      if (!line.ingredientId) {
        ontbreekt.push({ recipeId: recipe.id, name: line.name ?? '(zonder naam)' });
      } else if (!bekend.has(line.ingredientId)) {
        ontbreekt.push({ recipeId: recipe.id, name: line.ingredientId });
      }
    }
  }
  return ontbreekt;
};
