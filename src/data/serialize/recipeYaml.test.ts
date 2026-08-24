import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recipeSchema } from '../../domain/schema/recipe';
import { parseYaml } from './yaml';
import { recipeToYaml } from './recipeYaml';

const bestanden = readdirSync('data/recipes').filter((naam) => naam.endsWith('.yaml'));

describe('recepten terugschrijven', () => {
  it('vindt de receptbestanden', () => {
    expect(bestanden.length).toBeGreaterThan(20);
  });

  it.each(bestanden)('%s blijft inhoudelijk gelijk na een rondje heen en terug', (naam) => {
    const tekst = readFileSync(`data/recipes/${naam}`, 'utf8');
    const origineel = recipeSchema.parse(parseYaml(tekst));
    const opnieuw = recipeSchema.parse(parseYaml(recipeToYaml(origineel)));
    expect(opnieuw).toEqual(origineel);
  });

  it.each(bestanden)('%s levert exact hetzelfde bestand op', (naam) => {
    const tekst = readFileSync(`data/recipes/${naam}`, 'utf8');
    // Als dit faalt geeft een wijziging via de app een onnodig grote diff.
    expect(recipeToYaml(recipeSchema.parse(parseYaml(tekst)))).toBe(tekst);
  });

  it('laat een notitie met een komma heel', () => {
    const recept = recipeSchema.parse({
      id: 'test',
      title: 'Test',
      times: { prep: 1, active: 1, passive: 0 },
      methods: ['koken'],
      difficulty: 'makkelijk',
      servings: 2,
      ingredients: [{ amount: 1, unit: 'stuks', ingredientId: 'ui', note: 'koud, in blokjes' }],
      steps: [{ text: 'Doe iets.' }],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const heenEnTerug = recipeSchema.parse(parseYaml(recipeToYaml(recept)));
    expect(heenEnTerug.ingredients[0]?.note).toBe('koud, in blokjes');
  });
});
