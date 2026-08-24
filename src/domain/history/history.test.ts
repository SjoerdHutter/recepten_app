import { describe, expect, it } from 'vitest';
import { cookedRecently, historyFor, pickSurprise, recentEntries, type History } from './history';
import { makeRecipe } from '../testing/fixtures';

const VANDAAG = '2026-05-13';

const geschiedenis: History = [
  { id: '1', recipeId: 'stoof', cookedAt: '2026-05-12', servings: 4, rating: 5 },
  { id: '2', recipeId: 'stoof', cookedAt: '2026-01-02', servings: 4, rating: 3 },
  { id: '3', recipeId: 'soep', cookedAt: '2026-02-01', servings: 2 },
  {
    id: '4',
    recipeId: 'stoof',
    cookedAt: '2026-03-15',
    servings: 6,
    note: 'Volgende keer de helft van de chili.',
  },
];

describe('kookgeschiedenis', () => {
  it('vat samen wat je met een recept deed', () => {
    const uit = historyFor(geschiedenis, 'stoof');
    expect(uit.timesCooked).toBe(3);
    expect(uit.lastCooked).toBe('2026-05-12');
    // Alleen de keren dat je een cijfer gaf tellen mee: (5 + 3) / 2.
    expect(uit.averageRating).toBe(4);
  });

  it('zet de meest recente keer vooraan', () => {
    expect(historyFor(geschiedenis, 'stoof').entries[0]?.id).toBe('1');
  });

  it('geeft niets terug voor een recept dat je nooit maakte', () => {
    const uit = historyFor(geschiedenis, 'onbekend');
    expect(uit.timesCooked).toBe(0);
    expect(uit.lastCooked).toBeUndefined();
    expect(uit.averageRating).toBeUndefined();
  });

  it('weet wat je de laatste twee weken kookte', () => {
    expect(cookedRecently(geschiedenis, 'stoof', VANDAAG)).toBe(1);
    expect(cookedRecently(geschiedenis, 'soep', VANDAAG)).toBeUndefined();
  });

  it('somt de laatste keren op, ongeacht het recept', () => {
    expect(recentEntries(geschiedenis, 2).map((e) => e.id)).toEqual(['1', '4']);
  });
});

describe('verrassingsknop', () => {
  const stoof = makeRecipe({ id: 'stoof', title: 'Stoofpot' });
  const soep = makeRecipe({ id: 'soep', title: 'Soep' });

  it('kiest altijd iets als er recepten zijn', () => {
    expect(pickSurprise([stoof, soep], [], VANDAAG, () => 0.5)?.id).toBeDefined();
  });

  it('geeft niets terug zonder recepten', () => {
    expect(pickSurprise([], [], VANDAAG)).toBeUndefined();
  });

  it('laat wat je net kookte veel minder kans maken', () => {
    // Stoofpot kookte je gisteren, soep in februari.
    let stoofTellers = 0;
    const rondes = 400;
    for (let i = 0; i < rondes; i++) {
      const trekking = (i + 0.5) / rondes;
      const gekozen = pickSurprise([stoof, soep], geschiedenis, VANDAAG, () => trekking);
      if (gekozen?.id === 'stoof') stoofTellers += 1;
    }
    // Ruim onder de helft, maar niet uitgesloten: soms wíl je hem weer.
    expect(stoofTellers).toBeGreaterThan(0);
    expect(stoofTellers / rondes).toBeLessThan(0.25);
  });

  it('geeft alles gelijke kans zonder geschiedenis', () => {
    let stoofTellers = 0;
    const rondes = 400;
    for (let i = 0; i < rondes; i++) {
      const trekking = (i + 0.5) / rondes;
      if (pickSurprise([stoof, soep], [], VANDAAG, () => trekking)?.id === 'stoof') {
        stoofTellers += 1;
      }
    }
    expect(stoofTellers / rondes).toBeCloseTo(0.5, 1);
  });
});
