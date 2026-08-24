import { describe, expect, it } from 'vitest';
import { roundInUnit } from './round';

describe('praktisch afronden', () => {
  it('rondt gewichten af op een maat die je kunt afwegen', () => {
    expect(roundInUnit(166.666, 'g')).toBe(170);
    expect(roundInUnit(600, 'g')).toBe(600);
    expect(roundInUnit(33.3, 'g')).toBe(35);
    expect(roundInUnit(12.4, 'g')).toBe(12);
    expect(roundInUnit(2.6, 'g')).toBe(2.5);
    expect(roundInUnit(1266, 'g')).toBe(1250);
  });

  it('rondt kilo en liter af in hun basiseenheid', () => {
    expect(roundInUnit(0.9, 'kg')).toBe(0.9);
    expect(roundInUnit(1.234, 'kg')).toBe(1.25);
    expect(roundInUnit(0.333, 'l')).toBe(0.33); // 333 ml wordt 330 ml
  });

  it('geeft geen derde ei maar hele of halve stuks', () => {
    expect(roundInUnit(0.3333, 'stuks')).toBe(0.5);
    expect(roundInUnit(2.25, 'stuks')).toBe(2.5);
    expect(roundInUnit(1.9, 'stuks')).toBe(2);
    expect(roundInUnit(0.1, 'teentje')).toBe(0.5);
  });

  it('laat een snufje een snufje', () => {
    expect(roundInUnit(0.25, 'snufje')).toBe(1);
    expect(roundInUnit(2.4, 'snufje')).toBe(2);
  });

  it('rondt lepels af op kwart en half', () => {
    expect(roundInUnit(0.6, 'tl')).toBe(0.5);
    expect(roundInUnit(1.4, 'el')).toBe(1.5);
    expect(roundInUnit(0.1, 'el')).toBe(0.25);
  });
});
