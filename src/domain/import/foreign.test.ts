import { describe, expect, it } from 'vitest';
import {
  convertForeign,
  convertTemperatures,
  englishSingular,
  fahrenheitToCelsius,
  ovenTempFrom,
  stripEnglishFiller,
} from './foreign';

describe('convertForeign', () => {
  it('rekent cups om naar milliliter en niet naar gram', () => {
    // Een cup meel weegt 120 g en een cup suiker 200 g; het gewicht hangt van
    // het product af, dus dat laat deze laag met rust.
    expect(convertForeign(1.5, 'cups')).toEqual({ amount: 360, unit: 'ml' });
  });

  it('houdt lepels lepels', () => {
    expect(convertForeign(2, 'tbsp')).toEqual({ amount: 2, unit: 'el' });
    expect(convertForeign(1, 'teaspoon')).toEqual({ amount: 1, unit: 'tl' });
  });

  it('rekent ounces en pounds naar gram', () => {
    expect(convertForeign(8, 'oz')?.amount).toBeCloseTo(226.8, 1);
    expect(convertForeign(1, 'lb')?.amount).toBeCloseTo(453.6, 1);
  });

  it('houdt fluid ounces uit elkaar van gewichts-ounces', () => {
    expect(convertForeign(4, 'fl oz')).toEqual({ amount: 118.28, unit: 'ml' });
  });

  it('kent een pakje boter', () => {
    expect(convertForeign(1, 'stick')).toEqual({ amount: 113, unit: 'g' });
  });

  it('vertaalt Engelse telwoorden naar de eenheden van de app', () => {
    expect(convertForeign(3, 'cloves')).toEqual({ amount: 3, unit: 'teentje' });
    expect(convertForeign(2, 'sprigs')).toEqual({ amount: 2, unit: 'takje' });
    expect(convertForeign(1, 'pinch')).toEqual({ amount: 1, unit: 'snufje' });
  });

  it('negeert punten en hoofdletters', () => {
    expect(convertForeign(1, 'Tbsp.')).toEqual({ amount: 1, unit: 'el' });
  });

  it('geeft niets terug bij een woord dat geen maat is', () => {
    expect(convertForeign(2, 'onions')).toBeNull();
    expect(convertForeign(1, '')).toBeNull();
  });
});

describe('fahrenheitToCelsius', () => {
  it('rondt af op vijf graden, want een oven staat niet op 176', () => {
    expect(fahrenheitToCelsius(350)).toBe(175);
    expect(fahrenheitToCelsius(400)).toBe(205);
    expect(fahrenheitToCelsius(325)).toBe(165);
  });
});

describe('convertTemperatures', () => {
  it('vervangt graden in een zin', () => {
    expect(convertTemperatures('Preheat the oven to 350°F.')).toBe('Preheat the oven to 175 °C.');
  });

  it('slikt een omrekening die er al staat', () => {
    expect(convertTemperatures('Bake at 400°F (200°C) for 20 minutes.')).toBe(
      'Bake at 205 °C for 20 minutes.',
    );
  });

  it('laat een temperatuur in Celsius met rust', () => {
    const zin = 'Verwarm de oven voor op 180 °C.';
    expect(convertTemperatures(zin)).toBe(zin);
  });

  it('laat een losse F die geen temperatuur is met rust', () => {
    expect(convertTemperatures('Roer met vork F erbij')).toBe('Roer met vork F erbij');
  });
});

describe('ovenTempFrom', () => {
  it('neemt de Celsius als die er staat', () => {
    expect(ovenTempFrom('Verwarm de oven voor op 200 °C')).toBe(200);
  });

  it('rekent anders de Fahrenheit om', () => {
    expect(ovenTempFrom('Preheat the oven to 425 F')).toBe(220);
  });

  it('geeft niets terug zonder temperatuur', () => {
    expect(ovenTempFrom('Snijd de ui fijn')).toBeUndefined();
  });
});

describe('englishSingular', () => {
  it('kent de gewone meervoudsvormen', () => {
    expect(englishSingular('tomatoes')).toContain('tomato');
    expect(englishSingular('onions')).toContain('onion');
    expect(englishSingular('berries')).toContain('berry');
    expect(englishSingular('leaves')).toContain('leaf');
  });

  it('geeft niets terug bij een enkelvoud', () => {
    expect(englishSingular('onion')).toEqual([]);
  });
});

describe('stripEnglishFiller', () => {
  it('haalt de bijvoeglijke naamwoorden voor de naam weg', () => {
    expect(stripEnglishFiller('large onion')).toBe('onion');
    expect(stripEnglishFiller('freshly ground black pepper')).toBe('black pepper');
    expect(stripEnglishFiller('extra virgin olive oil')).toBe('virgin olive oil');
  });

  it('houdt de naam over als er niets anders overblijft', () => {
    expect(stripEnglishFiller('fresh')).toBe('fresh');
  });
});
