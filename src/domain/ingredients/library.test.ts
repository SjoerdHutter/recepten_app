import { describe, expect, it } from 'vitest';
import { normalizeName } from './library';
import { testLibrary } from '../testing/fixtures';

describe('koppelen van ingrediëntnamen', () => {
  it('haalt hoofdletters, accenten en spaties weg', () => {
    expect(normalizeName('  Gele   Ui ')).toBe('gele ui');
    expect(normalizeName('crème fraîche')).toBe('creme fraiche');
  });

  it('koppelt meervouden en synoniemen aan hetzelfde ingrediënt', () => {
    const ui = testLibrary.match('ui');
    expect(testLibrary.match('uien')).toBe(ui);
    expect(testLibrary.match('Uien')).toBe(ui);
    expect(testLibrary.match('gele ui')).toBe(ui);
    expect(testLibrary.match('onion')).toBe(ui);
  });

  it('koppelt onregelmatige meervouden via het meervoudsveld', () => {
    expect(testLibrary.match('eieren')?.id).toBe('ei');
    expect(testLibrary.match('laurierblaadjes')?.id).toBe('laurierblad');
  });

  it('geeft niets terug voor een onbekende naam', () => {
    expect(testLibrary.match('drakenfruit')).toBeUndefined();
  });

  it('zoekt met exacte treffers eerst', () => {
    const resultaten = testLibrary.search('ui');
    expect(resultaten[0]?.id).toBe('ui');
  });
});
