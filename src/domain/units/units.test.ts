import { describe, expect, it } from 'vitest';
import { aggregationKey, fromBase, toBase } from './units';

describe('eenheden', () => {
  it('rekent naar de basiseenheid', () => {
    expect(toBase({ amount: 1.5, unit: 'kg' })).toBe(1500);
    expect(toBase({ amount: 2, unit: 'l' })).toBe(2000);
    expect(toBase({ amount: 2, unit: 'el' })).toBe(30);
    expect(toBase({ amount: 3, unit: 'tl' })).toBe(15);
  });

  it('telt gram en kilo bij elkaar op, en milliliter en liter', () => {
    expect(aggregationKey('g')).toBe(aggregationKey('kg'));
    expect(aggregationKey('ml')).toBe(aggregationKey('l'));
    expect(aggregationKey('el')).toBe(aggregationKey('ml'));
  });

  it('houdt verschillende manieren van tellen uit elkaar', () => {
    expect(aggregationKey('teentje')).not.toBe(aggregationKey('stuks'));
    expect(aggregationKey('bosje')).not.toBe(aggregationKey('stuks'));
    expect(aggregationKey('stuks')).not.toBe(aggregationKey('g'));
  });

  it('kiest bij het terugrekenen de leesbaarste eenheid', () => {
    expect(fromBase(1500, 'massa')).toEqual({ amount: 1.5, unit: 'kg' });
    expect(fromBase(800, 'massa')).toEqual({ amount: 800, unit: 'g' });
    expect(fromBase(1000, 'volume')).toEqual({ amount: 1, unit: 'l' });
    expect(fromBase(250, 'volume')).toEqual({ amount: 250, unit: 'ml' });
  });

  it('houdt lepels lepels zolang het klein blijft', () => {
    expect(fromBase(45, 'volume', 'el')).toEqual({ amount: 3, unit: 'el' });
    // Boven de honderd milliliter is een maatbeker praktischer dan tellen met lepels.
    expect(fromBase(150, 'volume', 'el')).toEqual({ amount: 150, unit: 'ml' });
  });
});
