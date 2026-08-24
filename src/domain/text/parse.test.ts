import { describe, expect, it } from 'vitest';
import { parseRecipeText } from './parse';
import { testLibrary } from '../testing/fixtures';

const tekst = `Snelle courgettepasta

Voor 4 personen
Bereidingstijd: 20 minuten
Voorbereiden: 10 minuten

Ingrediënten
350 g spaghetti
2 courgettes, in dunne plakjes
2 teentjes knoflook
3 el olijfolie
1/2 citroen
snufje zout
250 ml slagroom

Bereiding
1. Kook de spaghetti beetgaar.
2. Bak de courgette op hoog vuur.
3. Schep alles door elkaar en serveer.`;

describe('geplakte tekst omzetten', () => {
  const resultaat = parseRecipeText(tekst, testLibrary);

  it('pakt de titel en het aantal personen', () => {
    expect(resultaat.title).toBe('Snelle courgettepasta');
    expect(resultaat.servings).toBe(4);
  });

  it('herkent de tijden apart', () => {
    expect(resultaat.times.prep).toBe(10);
    expect(resultaat.times.active).toBe(20);
  });

  it('leest hoeveelheid, eenheid en naam uit elke regel', () => {
    const spaghetti = resultaat.ingredients[0];
    expect(spaghetti).toMatchObject({ amount: 350, unit: 'g', name: 'spaghetti' });
  });

  it('koppelt aan de bibliotheek waar dat kan', () => {
    const knoflook = resultaat.ingredients.find((i) => i.ingredientId === 'knoflook');
    expect(knoflook).toMatchObject({ amount: 2, unit: 'teentje' });
    const room = resultaat.ingredients.find((i) => i.ingredientId === 'slagroom');
    expect(room).toMatchObject({ amount: 250, unit: 'ml' });
  });

  it('zet de toelichting achter de komma apart', () => {
    const courgette = resultaat.ingredients[1];
    expect(courgette?.note).toBe('in dunne plakjes');
    expect(courgette?.unit).toBe('stuks');
  });

  it('begrijpt breuken en losse eenheidswoorden', () => {
    const citroen = resultaat.ingredients.find((i) => i.name.includes('citroen'));
    expect(citroen?.amount).toBe(0.5);
    // Een eenheidswoord zonder getal is er één.
    const zout = resultaat.ingredients.find((i) => i.ingredientId === 'zout');
    expect(zout).toMatchObject({ unit: 'snufje', amount: 1 });
  });

  it('houdt de stappen zonder nummering over', () => {
    expect(resultaat.steps).toHaveLength(3);
    expect(resultaat.steps[0]).toBe('Kook de spaghetti beetgaar.');
  });

  it('herkent "naar smaak" en splitst twee namen', () => {
    const uitkomst = parseRecipeText(
      ['Testgerecht', 'Ingrediënten', '1 ui', 'Zout en peper naar smaak'].join('\n'),
      testLibrary,
    );
    const smaak = uitkomst.ingredients.filter((i) => i.scales === 'taste');
    expect(smaak.map((i) => i.name)).toEqual(['zout', 'zwarte peper']);
    expect(smaak[0]?.amount).toBeUndefined();
  });

  it('koppelt ook als er woorden voor de naam staan', () => {
    const uitkomst = parseRecipeText(
      ['Test', 'Ingrediënten', '2 grote gele uien', '1 flinke teen knoflook'].join('\n'),
      testLibrary,
    );
    expect(uitkomst.ingredients.map((i) => i.ingredientId)).toEqual(['ui', 'knoflook']);
  });

  it('verzint niets bij een lege invoer', () => {
    const leeg = parseRecipeText('', testLibrary);
    expect(leeg.ingredients).toHaveLength(0);
    expect(leeg.steps).toHaveLength(0);
    expect(leeg.title).toBe('Naamloos recept');
  });

  it('werkt ook met streepjes en zonder kopjes', () => {
    const kort = parseRecipeText(
      ['Uiensoep', '- 3 uien', '- 1 el olijfolie', 'Snipper de uien en bak ze goudbruin.'].join(
        '\n',
      ),
      testLibrary,
    );
    expect(kort.ingredients.map((i) => i.ingredientId)).toEqual(['ui', 'olijfolie']);
    expect(kort.steps).toEqual(['Snipper de uien en bak ze goudbruin.']);
  });
});
