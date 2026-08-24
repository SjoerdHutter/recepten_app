import { describe, expect, it } from 'vitest';
import { compareTins, describeTin, tinArea } from './convert';

describe('ovenschalen omrekenen', () => {
  it('rekent het bodemoppervlak uit', () => {
    expect(tinArea({ shape: 'rond', diameter: 20 })).toBeCloseTo(314.16, 1);
    expect(tinArea({ shape: 'rechthoekig', length: 30, width: 20 })).toBe(600);
  });

  it('vergelijkt twee vormen op oppervlak, niet op doorsnede', () => {
    // 24 cm klinkt als 20% groter dan 20 cm, maar het is 44% meer bodem.
    const advies = compareTins({ shape: 'rond', diameter: 20 }, { shape: 'rond', diameter: 24 });
    expect(advies.ratio).toBeCloseTo(1.44, 2);
    expect(advies.scaleBy).toBeCloseTo(1.44, 2);
  });

  it('adviseert eerder te gaan kijken in een grotere vorm', () => {
    const advies = compareTins(
      { shape: 'rond', diameter: 20 },
      { shape: 'rond', diameter: 24 },
      60,
    );
    // Zelfde beslag dunner uitgesmeerd is eerder gaar.
    expect(advies.checkFromMinutes).toBeLessThan(60);
    expect(advies.checkFromMinutes).toBeGreaterThan(30);
  });

  it('adviseert langer bij een kleinere vorm', () => {
    const advies = compareTins(
      { shape: 'rond', diameter: 24 },
      { shape: 'rond', diameter: 20 },
      60,
    );
    expect(advies.ratio).toBeLessThan(1);
    expect(advies.checkFromMinutes).toBeGreaterThan(60);
  });

  it('laat de baktijd weg als het recept er geen noemt', () => {
    const advies = compareTins({ shape: 'rond', diameter: 20 }, { shape: 'rond', diameter: 24 });
    expect(advies.checkFromMinutes).toBeUndefined();
  });

  it('vergelijkt rond met rechthoekig', () => {
    const advies = compareTins(
      { shape: 'rond', diameter: 24 },
      { shape: 'rechthoekig', length: 30, width: 20 },
    );
    expect(advies.ratio).toBeCloseTo(1.33, 2);
  });

  it('schrijft een vorm leesbaar op', () => {
    expect(describeTin({ shape: 'rond', diameter: 24 })).toBe('rond, 24 cm');
    expect(describeTin({ shape: 'rechthoekig', length: 30, width: 20 })).toBe('30 × 20 cm');
  });
});
