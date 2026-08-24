/**
 * Controleert alle databestanden tegen het schema. Draait in de CI bij elke
 * push, zodat een recept dat met de hand op github.com is aangepast niet stilletjes
 * kapot gaat.
 *
 *   npm run validate
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_PATHS } from '../src/config';
import { buildDataset, findUnlinkedIngredients, type SourceFile } from '../src/data/dataset';

const lees = (map: string): SourceFile[] => {
  if (!existsSync(map)) return [];
  return readdirSync(map)
    .filter((naam) => naam.endsWith('.yaml') || naam.endsWith('.yml'))
    .map((naam) => ({ path: `${map}/${naam}`, text: readFileSync(join(map, naam), 'utf8') }));
};

const bestanden = [...lees(DATA_PATHS.recipes), ...lees(DATA_PATHS.ingredients)];
const dataset = buildDataset(bestanden);

const fouten: string[] = [];
const waarschuwingen: string[] = [];

for (const probleem of dataset.problems) {
  fouten.push(`${probleem.path}: ${probleem.message}`);
}

// Het id moet gelijk zijn aan de bestandsnaam, anders is een recept twee keer
// te bereiken en weet de app niet welk bestand het moet bijwerken.
for (const recipe of dataset.recipes) {
  const verwacht = `${DATA_PATHS.recipes}/${recipe.id}.yaml`;
  if (!bestanden.some((b) => b.path === verwacht)) {
    fouten.push(`${recipe.id}: het id komt niet overeen met de bestandsnaam (${verwacht})`);
  }
  if (recipe.image && !existsSync(recipe.image)) {
    fouten.push(`${recipe.id}: de afbeelding ${recipe.image} bestaat niet`);
  }
}

// Losse ingrediëntnamen laten de CI niet falen: de app dwingt koppeling af bij
// het opslaan, maar een met de hand toegevoegde regel mag blijven staan.
for (const los of findUnlinkedIngredients(dataset)) {
  waarschuwingen.push(`${los.recipeId}: "${los.name}" is niet gekoppeld aan de bibliotheek`);
}

// Een allergeen dat via een ingrediënt binnenkomt hoort ook op het recept te
// staan, anders werkt de harde uitsluiting niet.
const perId = new Map(dataset.ingredients.map((i) => [i.id, i]));
for (const recipe of dataset.recipes) {
  const uitIngredienten = new Set(
    recipe.ingredients.flatMap((line) => perId.get(line.ingredientId ?? '')?.allergens ?? []),
  );
  for (const allergeen of uitIngredienten) {
    if (!recipe.allergens.includes(allergeen)) {
      waarschuwingen.push(
        `${recipe.id}: allergeen "${allergeen}" zit wel in de ingrediënten maar staat niet op het recept`,
      );
    }
  }
}

console.log(
  `${dataset.recipes.length} recepten en ${dataset.ingredients.length} ingrediënten gecontroleerd.`,
);
for (const waarschuwing of waarschuwingen) console.log(`  let op: ${waarschuwing}`);
for (const fout of fouten) console.error(`  fout: ${fout}`);

if (fouten.length > 0) {
  console.error(`\n${fouten.length} fout(en) gevonden.`);
  process.exit(1);
}
console.log('Alles in orde.');
