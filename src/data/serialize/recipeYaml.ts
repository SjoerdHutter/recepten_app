import { Document, isMap, isSeq, type Node } from 'yaml';
import { RECIPE_FIELD_ORDER, type Recipe } from '../../domain/schema/recipe';
import { INGREDIENT_FIELD_ORDER, type Ingredient } from '../../domain/schema/ingredient';
import { orderKeys } from './yaml';

/**
 * Schrijft een recept terug naar YAML in precies dezelfde vorm als de bestanden
 * die al in de repo staan. Dat is geen cosmetiek: een recept dat je in de app
 * aanpast moet een kleine, leesbare diff opleveren, anders is de
 * git-geschiedenis waardeloos.
 *
 * Het aanhalen van waarden wordt aan de yaml-bibliotheek overgelaten. Met de
 * hand quoten ging eerder mis: een notitie met een komma binnen accolades kapte
 * de waarde af, en YAML meldt dat niet.
 */

const REGEL_VELDEN = [
  'amount',
  'unit',
  'ingredientId',
  'name',
  'note',
  'scales',
  'optional',
  'step',
] as const;

const STAP_VELDEN = ['text', 'timer', 'ovenTemp'] as const;

/** Weglaten wat toch de standaardwaarde is, zodat een regel kort blijft. */
const ingredientRegel = (line: Recipe['ingredients'][number]): Record<string, unknown> => {
  const regel: Record<string, unknown> = {};
  for (const veld of REGEL_VELDEN) {
    const waarde = line[veld];
    if (waarde === undefined) continue;
    if (veld === 'scales' && waarde === 'linear') continue;
    if (veld === 'optional' && waarde === false) continue;
    regel[veld] = waarde;
  }
  return regel;
};

const stapRegel = (step: Recipe['steps'][number]): Record<string, unknown> => {
  const regel: Record<string, unknown> = {};
  for (const veld of STAP_VELDEN) {
    if (step[veld] !== undefined) regel[veld] = step[veld];
  }
  return regel;
};

const zetFlow = (node: unknown): void => {
  if (isMap(node) || isSeq(node)) (node as Node & { flow: boolean }).flow = true;
};

/**
 * De bibliotheek zet spaties binnen élke flow-collectie. De bestanden schrijven
 * lijsten zonder die spaties ([oven, koken]) en objecten juist met
 * ({ amount: 2 }), dus de lijsten worden hier rechtgetrokken.
 */
const LIJSTVELDEN = /^(\s*)(methods|tags|season|allergens|synonyms): \[ (.*) \]$/gm;

const schrijf = (doc: Document): string =>
  doc.toString({
    // Geen automatische regelafbreking: dat maakt diffs onleesbaar.
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    nullStr: '',
  }).replace(LIJSTVELDEN, '$1$2: [$3]');

export const recipeToYaml = (recipe: Recipe): string => {
  const plat = orderKeys(
    {
      ...recipe,
      ingredients: recipe.ingredients.map(ingredientRegel),
      steps: recipe.steps.map(stapRegel),
    },
    RECIPE_FIELD_ORDER,
  );
  // Een lege omschrijving hoort niet in het bestand.
  if (!plat['description']) delete plat['description'];

  const doc = new Document(plat);
  for (const veld of ['methods', 'tags', 'season', 'allergens']) {
    zetFlow(doc.get(veld, true));
  }
  zetFlow(doc.get('source', true));
  const ingredienten = doc.get('ingredients', true);
  if (isSeq(ingredienten)) ingredienten.items.forEach(zetFlow);

  return schrijf(doc);
};

/** Eén bestand van de ingrediëntenbibliotheek, gesorteerd op naam. */
export const ingredientsToYaml = (ingredients: Ingredient[], kop?: string): string => {
  const gesorteerd = [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  const doc = new Document(
    gesorteerd.map((ingredient) => {
      const plat = orderKeys({ ...ingredient }, INGREDIENT_FIELD_ORDER);
      if (Array.isArray(plat['synonyms']) && plat['synonyms'].length === 0) delete plat['synonyms'];
      if (Array.isArray(plat['allergens']) && plat['allergens'].length === 0) delete plat['allergens'];
      if (plat['conversions'] && Object.keys(plat['conversions']).length === 0) {
        delete plat['conversions'];
      }
      return plat;
    }),
  );
  if (isSeq(doc.contents)) {
    for (const item of doc.contents.items) {
      if (!isMap(item)) continue;
      zetFlow(item.get('synonyms', true));
      zetFlow(item.get('allergens', true));
      zetFlow(item.get('packaging', true));
      zetFlow(item.get('price', true));
      zetFlow(item.get('nutrition', true));
      const omrekening = item.get('conversions', true);
      zetFlow(omrekening);
      if (isMap(omrekening)) omrekening.items.forEach((paar) => zetFlow(paar.value));
    }
  }
  return (kop ? `${kop}\n` : '') + schrijf(doc);
};
