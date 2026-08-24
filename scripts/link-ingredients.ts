/**
 * Koppelt receptregels met een losse naam alsnog aan de ingrediëntenbibliotheek.
 *
 * Nodig omdat een recept ook met de hand op github.com bewerkt kan worden, en
 * dan is een regel als "2 el uien" zo getypt zonder ingredientId. Hij werkt wel,
 * maar telt niet op met dezelfde ingrediënten uit andere recepten. Dit script
 * loopt alles na en zet de koppeling erin waar de bibliotheek zeker weet welk
 * ingrediënt bedoeld is.
 *
 *   npm run link            laat zien wat er zou veranderen
 *   npm run link -- --write past het toe
 *
 * Hetzelfde werk kan met de hand in de app, onder Instellingen ▸ Bibliotheek ▸
 * Opruimen. Dit script is er voor als het er veel zijn.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { recipeToYaml } from '../src/data/serialize/recipeYaml';
import { parseYaml } from '../src/data/serialize/yaml';
import { linkRecipeLine, type LibraryState } from '../src/domain/ingredients/edits';
import { analyseLibrary } from '../src/domain/ingredients/maintenance';
import { ingredientFileSchema, type Ingredient } from '../src/domain/schema/ingredient';
import { recipeSchema, type Recipe } from '../src/domain/schema/recipe';

const schrijven = process.argv.includes('--write');

const lees = <T>(map: string, verwerk: (ruw: unknown, bestand: string) => T[]): T[] =>
  readdirSync(map)
    .filter((naam) => naam.endsWith('.yaml'))
    .flatMap((naam) => verwerk(parseYaml(readFileSync(`${map}/${naam}`, 'utf8')), naam));

const recipes: Recipe[] = lees('data/recipes', (ruw, bestand) => {
  const uitkomst = recipeSchema.safeParse(ruw);
  if (!uitkomst.success) {
    console.error(`${bestand} is geen geldig recept; draai eerst npm run validate.`);
    process.exit(1);
  }
  return [uitkomst.data];
});

const ingredients: Ingredient[] = lees('data/ingredients', (ruw, bestand) => {
  const uitkomst = ingredientFileSchema.safeParse(ruw);
  if (!uitkomst.success) {
    console.error(`${bestand} is geen geldig bibliotheekbestand; draai eerst npm run validate.`);
    process.exit(1);
  }
  return uitkomst.data;
});

let state: LibraryState = { ingredients, recipes };
const rapport = analyseLibrary(state);

const teKoppelen = rapport.unlinked.filter((regel) => regel.suggestion);
const zonderSuggestie = rapport.unlinked.filter((regel) => !regel.suggestion);

if (rapport.unlinked.length === 0) {
  console.log('Elke receptregel is al gekoppeld. Niets te doen.');
  process.exit(0);
}

console.log(`${teKoppelen.length} regels kunnen gekoppeld worden:\n`);
for (const regel of teKoppelen) {
  console.log(
    `  ${regel.recipeId} regel ${regel.lineIndex + 1}: "${regel.name}" → ${regel.suggestion?.id}`,
  );
}

if (zonderSuggestie.length > 0) {
  console.log(`\n${zonderSuggestie.length} regels weet de bibliotheek niet thuis te brengen:\n`);
  for (const regel of zonderSuggestie) {
    console.log(`  ${regel.recipeId} regel ${regel.lineIndex + 1}: "${regel.name}"`);
  }
  console.log('\nVoeg die ingrediënten toe aan de bibliotheek, of koppel ze in de app.');
}

if (!schrijven) {
  console.log('\nDraai met --write om dit toe te passen.');
  process.exit(0);
}

// Van achter naar voren, zodat een index niet verschuift door een eerdere
// wijziging in hetzelfde recept.
const gewijzigdeRecepten = new Set<string>();
for (const regel of [...teKoppelen].reverse()) {
  const suggestie = regel.suggestion;
  if (!suggestie) continue;
  const bewerking = linkRecipeLine(state, regel.recipeId, regel.lineIndex, suggestie.id);
  state = bewerking.state;
  gewijzigdeRecepten.add(regel.recipeId);
}

for (const id of gewijzigdeRecepten) {
  const recept = state.recipes.find((recipe) => recipe.id === id);
  if (!recept) continue;
  writeFileSync(`data/recipes/${id}.yaml`, recipeToYaml(recept), 'utf8');
}

console.log(
  `\n${teKoppelen.length} regels gekoppeld in ${gewijzigdeRecepten.size} recept${gewijzigdeRecepten.size === 1 ? '' : 'en'}.`,
);
