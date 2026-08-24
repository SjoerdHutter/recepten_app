import { describe, expect, it } from 'vitest';
import { formatAmount, formatMinutes, formatQuantity } from './format';

describe('Nederlandse notatie', () => {
  it('gebruikt een komma als decimaalteken', () => {
    expect(formatQuantity({ amount: 1.5, unit: 'kg' })).toBe('1,5 kg');
    expect(formatQuantity({ amount: 0.9, unit: 'l' })).toBe('0,9 l');
  });

  it('gebruikt breuken waar dat prettiger leest', () => {
    expect(formatAmount(0.5, 'stuks')).toBe('½');
    expect(formatAmount(1.5, 'el')).toBe('1½');
    expect(formatAmount(2.25, 'stuks')).toBe('2¼');
    // Bij gewichten zou een breuk juist raar staan.
    expect(formatAmount(2.5, 'g')).toBe('2,5');
  });

  it('schrijft telbare eenheden in het meervoud', () => {
    expect(formatQuantity({ amount: 2, unit: 'teentje' })).toBe('2 teentjes');
    expect(formatQuantity({ amount: 1, unit: 'teentje' })).toBe('1 teentje');
    expect(formatQuantity({ amount: 1, unit: 'snufje' })).toBe('1 snufje');
    // Bij stuks staat er alleen een getal; het meervoud zit in de naam.
    expect(formatQuantity({ amount: 3, unit: 'stuks' })).toBe('3');
  });

  it('schrijft tijden uit', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 u');
    expect(formatMinutes(85)).toBe('1 u 25 min');
    expect(formatMinutes(225)).toBe('3 u 45 min');
  });
});
