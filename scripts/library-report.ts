/**
 * Rapporteert wat er in de bibliotheek scheef staat: receptregels zonder
 * koppeling, verwijzingen naar een ingrediënt dat niet bestaat, verweesde
 * ingrediënten en dubbelingen.
 *
 * De CI draait dit als rapport en laat het niet falen op een losse naam — dat
 * was de afspraak toen we kozen voor "strikt in de app, zacht in de CI", zodat
 * je een recept ook gewoon met de hand op github.com kunt bijwerken. Alleen een
 * verwijzing naar een ingrediënt dat níét bestaat is een echte fout.
 *
 *   npm run report            rapport
 *   npm run report -- --strict   faalt ook op ongekoppelde regels
 */
import { readFileSync, readdirSync } from 'node:fs';
import { analyseLibrary } from '../src/domain/ingredients/maintenance';
import { ingredientFileSchema } from '../src/domain/schema/ingredient';
import { recipeSchema, type Recipe } from '../src/domain/schema/recipe';
import type { Ingredient } from '../src/domain/schema/ingredient';
import { parseYaml } from '../src/data/serialize/yaml';

const strikt = process.argv.includes('--strict');

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

const rapport = analyseLibrary({ ingredients, recipes });

console.log(`${recipes.length} recepten, ${ingredients.length} ingrediënten.\n`);

if (rapport.missing.length > 0) {
  console.log(`FOUT: ${rapport.missing.length} verwijzingen naar een onbekend ingrediënt`);
  for (const item of rapport.missing) {
    console.log(`  ${item.recipeId} regel ${item.lineIndex + 1}: "${item.ingredientId}"`);
  }
  console.log('');
}

if (rapport.unlinked.length > 0) {
  console.log(`${rapport.unlinked.length} receptregels zonder koppeling`);
  for (const item of rapport.unlinked.slice(0, 30)) {
    const suggestie = item.suggestion ? ` → misschien ${item.suggestion.id}` : '';
    console.log(`  ${item.recipeId} regel ${item.lineIndex + 1}: "${item.name}"${suggestie}`);
  }
  if (rapport.unlinked.length > 30) console.log(`  … en nog ${rapport.unlinked.length - 30}`);
  console.log('');
}

if (rapport.duplicates.length > 0) {
  console.log(`${rapport.duplicates.length} mogelijke dubbelingen`);
  for (const paar of rapport.duplicates.slice(0, 30)) {
    const score = paar.reason === 'lijkt sterk op elkaar' ? ` (${paar.score.toFixed(2)})` : '';
    console.log(`  ${paar.a.id} / ${paar.b.id} — ${paar.reason}${score}`);
  }
  if (rapport.duplicates.length > 30) console.log(`  … en nog ${rapport.duplicates.length - 30}`);
  console.log('');
}

if (rapport.orphans.length > 0) {
  console.log(`${rapport.orphans.length} ingrediënten die geen enkel recept gebruikt`);
  console.log(`  ${rapport.orphans.map((item) => item.id).join(', ')}\n`);
}

if (rapport.total === 0) console.log('Niets op te ruimen.');

// Verweesde ingrediënten en gelijkende namen zijn opruimwerk, geen fout: een
// startbibliotheek hoort ruimer te zijn dan wat je vandaag kookt.
const fataal = rapport.missing.length > 0 || (strikt && rapport.unlinked.length > 0);
process.exit(fataal ? 1 : 0);
