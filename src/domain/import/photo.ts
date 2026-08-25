import { z } from 'zod';
import type { IngredientLibrary } from '../ingredients/library';
import type { ParsedRecipe } from '../text/parse';
import { convertTemperatures, ovenTempFrom } from './foreign';
import { parseImportLine } from './line';

/**
 * Een foto van een kookboekpagina of een handgeschreven kaartje omzetten naar
 * een recept.
 *
 * Het model levert bewust géén compleet receptbestand op. Het krijgt één taak:
 * overtypen wat er staat, in dezelfde losse regels als een receptensite ze
 * levert. Alles daarna — de eenheden omrekenen, de ingrediënten koppelen, de
 * temperatuur naar Celsius — doet dezelfde code als bij het importeren vanaf
 * een URL. Zo is er één plek waar het misgaat in plaats van twee, en die plek
 * is getest.
 *
 * Wat het model teruggeeft is niet te vertrouwen: het is een gok over wat er op
 * een foto staat. Daarom gaat het door een schema, en daarom is de
 * controlestap in het formulier niet over te slaan.
 */

export const PHOTO_PROMPT = `Je krijgt een foto van een recept: een kookboekpagina, een tijdschrift of een handgeschreven kaartje.

Typ over wat er staat. Verzin niets bij. Staat er iets niet op de foto, laat het veld dan weg of leeg.

Antwoord met uitsluitend JSON, zonder toelichting eromheen, in deze vorm:

{
  "title": "de titel van het gerecht",
  "description": "een of twee zinnen, alleen als die er staan",
  "servings": 4,
  "prepMinutes": 15,
  "activeMinutes": 30,
  "passiveMinutes": 0,
  "ingredients": ["200 g bloem", "2 uien, gesnipperd", "peper en zout naar smaak"],
  "steps": ["Verwarm de oven voor op 180 graden.", "Snipper de uien."],
  "unreadable": ["regels die je niet kon lezen, letterlijk zo goed als het lukt"]
}

Regels:
- De ingrediënten schrijf je als losse regels precies zoals ze op de foto staan, inclusief de hoeveelheid en de eenheid. Reken niets om.
- De stappen schrijf je als losse zinnen, zonder nummers ervoor.
- Zet de tijden in hele minuten. Staat er alleen een totale tijd, zet die dan bij activeMinutes.
- Kun je een woord niet lezen, zet het dan in "unreadable" in plaats van te raden.
- Is het geen recept, geef dan {"title": "", "ingredients": [], "steps": [], "unreadable": []} terug.`;

/**
 * Het model kán van alles teruggeven; dit is wat de app ervan aanneemt. Alles
 * wat er niet in past valt eruit in plaats van dat het verderop iets sloopt.
 */
export const photoResultSchema = z.object({
  title: z.string().default(''),
  description: z.string().optional(),
  servings: z.number().int().min(1).max(100).optional(),
  prepMinutes: z.number().int().min(0).max(6000).optional(),
  activeMinutes: z.number().int().min(0).max(6000).optional(),
  passiveMinutes: z.number().int().min(0).max(20000).optional(),
  ingredients: z.array(z.string()).default([]),
  steps: z.array(z.string()).default([]),
  unreadable: z.array(z.string()).default([]),
});

export type PhotoResult = z.infer<typeof photoResultSchema>;

/**
 * Modellen zetten hun JSON graag in een codeblok, of schrijven er een zin voor.
 * Dit vist het object eruit zonder daar boos over te doen.
 */
export const extractJson = (antwoord: string): unknown => {
  const zonderHek = antwoord.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = zonderHek.indexOf('{');
  const eind = zonderHek.lastIndexOf('}');
  if (start < 0 || eind <= start) throw new Error('Het antwoord bevatte geen JSON.');
  return JSON.parse(zonderHek.slice(start, eind + 1));
};

/**
 * Van het antwoord van het model naar hetzelfde soort resultaat als de
 * URL-import, zodat het door dezelfde controlestap gaat.
 */
export const photoToRecipe = (
  ruw: unknown,
  library: IngredientLibrary,
  bron?: string,
): ParsedRecipe => {
  const uitkomst = photoResultSchema.safeParse(ruw);
  if (!uitkomst.success) {
    throw new Error('Het model gaf iets terug wat de app niet kon lezen.');
  }
  const gelezen = uitkomst.data;

  const ingredients = [];
  const leftovers = [...gelezen.unreadable];
  for (const regel of gelezen.ingredients) {
    const gebouwd = parseImportLine(regel, library);
    if (gebouwd) ingredients.push(gebouwd);
    else if (regel.trim()) leftovers.push(regel);
  }

  const steps = gelezen.steps.map(convertTemperatures).filter((stap) => stap.trim().length > 2);

  const warnings: string[] = [];
  const onleesbaar = gelezen.unreadable.length;
  if (onleesbaar > 0) {
    warnings.push(
      onleesbaar === 1
        ? '1 regel was niet goed te lezen; die staat onderaan.'
        : `${onleesbaar} regels waren niet goed te lezen; die staan onderaan.`,
    );
  }
  const ongekoppeld = ingredients.filter((regel) => !regel.ingredientId).length;
  if (ongekoppeld > 0) {
    warnings.push(
      `${ongekoppeld} ${ongekoppeld === 1 ? 'ingrediënt staat' : 'ingrediënten staan'} nog niet in de bibliotheek.`,
    );
  }
  warnings.push('Dit is overgetypt door een taalmodel. Loop het na voordat je het opslaat.');

  return {
    title: gelezen.title.trim() || 'Naamloos recept',
    ...(gelezen.description?.trim() ? { description: gelezen.description.trim() } : {}),
    ...(gelezen.servings ? { servings: gelezen.servings } : {}),
    times: {
      prep: gelezen.prepMinutes ?? 0,
      active: gelezen.activeMinutes ?? 0,
      passive: gelezen.passiveMinutes ?? 0,
    },
    ingredients,
    steps,
    ovenTemps: steps.map(ovenTempFrom),
    tags: [],
    ...(bron ? { source: { type: 'text' as const, text: bron } } : {}),
    leftovers,
    warnings,
  };
};
