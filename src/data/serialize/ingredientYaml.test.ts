import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ingredientFileSchema } from '../../domain/schema/ingredient';
import { parseYaml } from './yaml';
import { ingredientsToYaml } from './recipeYaml';

/**
 * Dezelfde afspraak als bij de recepten: wat de app schrijft moet er precies zo
 * uitzien als wat er al staat. Zonder deze test bleef ongemerkt dat de
 * lijstnormalisatie alleen werkte op regels aan het begin van de regel, waardoor
 * één samengevoegd ingrediënt het hele bestand herschreef.
 */

const bestanden = readdirSync('data/ingredients').filter((naam) => naam.endsWith('.yaml'));

const kop = (tekst: string): string | undefined => {
  const regels: string[] = [];
  for (const regel of tekst.split('\n')) {
    if (regel.startsWith('#')) regels.push(regel);
    else break;
  }
  return regels.length > 0 ? regels.join('\n') : undefined;
};

describe('bibliotheekbestanden terugschrijven', () => {
  it('vindt de bibliotheekbestanden', () => {
    expect(bestanden.length).toBeGreaterThan(5);
  });

  it.each(bestanden)('%s blijft inhoudelijk gelijk na een rondje heen en terug', (naam) => {
    const tekst = readFileSync(`data/ingredients/${naam}`, 'utf8');
    const origineel = ingredientFileSchema.parse(parseYaml(tekst));
    const opnieuw = ingredientFileSchema.parse(parseYaml(ingredientsToYaml(origineel)));
    expect(opnieuw).toEqual(origineel);
  });

  it.each(bestanden)('%s levert exact hetzelfde bestand op', (naam) => {
    const tekst = readFileSync(`data/ingredients/${naam}`, 'utf8');
    // Faalt dit, dan geeft één bewerking in de app een onnodig grote diff.
    expect(ingredientsToYaml(ingredientFileSchema.parse(parseYaml(tekst)), kop(tekst))).toBe(tekst);
  });

  it('schrijft ingesprongen lijsten zonder spaties binnen de haken', () => {
    const uit = ingredientsToYaml([
      {
        id: 'ui',
        name: 'ui',
        synonyms: ['gele ui', 'uitje'],
        category: 'groente-en-fruit',
        defaultUnit: 'stuks',
        conversions: {},
        allergens: ['melk'],
      },
    ]);
    expect(uit).toContain('synonyms: [gele ui, uitje]');
    expect(uit).toContain('allergens: [melk]');
    expect(uit).not.toContain('[ gele ui');
  });
});
