import { describe, expect, it } from 'vitest';
import { costOf, listCost, priceAgeInDays, recipeCost } from './cost';
import { roundToPackaging } from './packaging';
import { defaultProfile, moveInOrder, normalizeOrder, sortGroupsByStore } from './profile';
import { createLibrary } from '../ingredients/library';
import { ingredientSchema } from '../schema/ingredient';
import { buildShoppingList } from '../shopping/aggregate';
import { makeRecipe, testIngredients } from '../testing/fixtures';
import { formatQuantity } from '../units/format';

const metPrijs = [
  ...testIngredients.map((item) =>
    item.id === 'slagroom'
      ? ingredientSchema.parse({
          ...item,
          packaging: { amount: 250, unit: 'ml' },
          price: { amount: 1.29, per: 'l', date: '2026-05-01' },
        })
      : item.id === 'ui'
        ? ingredientSchema.parse({
            ...item,
            packaging: { amount: 1, unit: 'kg' },
            price: { amount: 1.5, per: 'kg', date: '2026-03-01' },
          })
        : item,
  ),
];
const bibliotheek = createLibrary(metPrijs);

describe('verpakkingsafronding', () => {
  const room = metPrijs.find((i) => i.id === 'slagroom');

  it('rondt naar boven af op hele pakken', () => {
    const advies = roundToPackaging({ amount: 150, unit: 'ml' }, room);
    expect(advies?.packs).toBe(1);
    expect(formatQuantity(advies!.totalBought)).toBe('250 ml');
    expect(formatQuantity(advies!.leftover!)).toBe('100 ml');
  });

  it('telt door naar twee pakken zodra er meer nodig is', () => {
    const advies = roundToPackaging({ amount: 300, unit: 'ml' }, room);
    expect(advies?.packs).toBe(2);
    expect(formatQuantity(advies!.leftover!)).toBe('200 ml');
  });

  it('meldt geen restje als het precies uitkomt', () => {
    const advies = roundToPackaging({ amount: 500, unit: 'ml' }, room);
    expect(advies?.packs).toBe(2);
    expect(advies?.leftover).toBeNull();
  });

  it('rekent over eenheden heen', () => {
    // Een halve liter is twee pakken van 250 ml.
    const advies = roundToPackaging({ amount: 0.5, unit: 'l' }, room);
    expect(advies?.packs).toBe(2);
  });

  it('geeft niets terug zonder bekende verpakking', () => {
    const knoflook = metPrijs.find((i) => i.id === 'knoflook');
    expect(roundToPackaging({ amount: 2, unit: 'teentje' }, knoflook)).toBeNull();
    expect(roundToPackaging({ amount: 2, unit: 'teentje' }, undefined)).toBeNull();
  });
});

describe('kosten schatten', () => {
  const room = metPrijs.find((i) => i.id === 'slagroom');

  it('rekent een prijs per liter om naar de gevraagde hoeveelheid', () => {
    // 1,29 per liter, dus 250 ml kost ongeveer 32 cent.
    expect(costOf({ amount: 250, unit: 'ml' }, room)?.amount).toBeCloseTo(0.3225, 3);
  });

  it('geeft de peildatum terug bij het bedrag', () => {
    expect(costOf({ amount: 100, unit: 'ml' }, room)?.date).toBe('2026-05-01');
  });

  it('geeft niets terug zonder prijs', () => {
    const knoflook = metPrijs.find((i) => i.id === 'knoflook');
    expect(costOf({ amount: 2, unit: 'teentje' }, knoflook)).toBeNull();
  });

  it('telt een lijst op en zegt hoeveel regels een prijs hadden', () => {
    const recept = makeRecipe({
      id: 'x',
      title: 'X',
      ingredients: [
        { amount: 500, unit: 'g', ingredientId: 'ui' },
        { amount: 200, unit: 'ml', ingredientId: 'slagroom' },
        { amount: 2, unit: 'teentje', ingredientId: 'knoflook' },
      ],
    });
    const lijst = buildShoppingList([{ recipe: recept, servings: 4 }], bibliotheek);
    const kosten = listCost(lijst, bibliotheek);
    // 500 g ui à 1,50/kg = 0,75; 200 ml room à 1,29/l = 0,258.
    expect(kosten.total).toBeCloseTo(1.008, 2);
    expect(kosten.known).toBe(2);
    expect(kosten.unknown).toBe(1);
    // De oudste peildatum bepaalt hoe hard het cijfer is.
    expect(kosten.oldestDate).toBe('2026-03-01');
  });

  it('rekent kosten per portie uit en schaalt mee', () => {
    const recept = makeRecipe({
      id: 'y',
      title: 'Y',
      servings: 4,
      ingredients: [{ amount: 1000, unit: 'g', ingredientId: 'ui' }],
    });
    expect(recipeCost(recept, bibliotheek).perServing).toBeCloseTo(0.375, 3);
    // Voor acht personen kost het dubbele, per portie hetzelfde.
    expect(recipeCost(recept, bibliotheek, 8).perServing).toBeCloseTo(0.375, 3);
    expect(recipeCost(recept, bibliotheek, 8).total).toBeCloseTo(3, 2);
  });

  it('zegt hoe oud de prijs is', () => {
    expect(priceAgeInDays('2026-05-01', new Date('2026-05-11T12:00:00'))).toBe(10);
    expect(priceAgeInDays(undefined, new Date())).toBeUndefined();
  });
});

describe('winkelprofielen', () => {
  it('begint met de standaard looproute', () => {
    expect(defaultProfile().order[0]).toBe('groente-en-fruit');
  });

  it('verplaatst een categorie in de volgorde', () => {
    const volgorde = moveInOrder(defaultProfile().order, 0, 2);
    expect(volgorde[2]).toBe('groente-en-fruit');
  });

  it('vult een oud profiel aan als er een categorie bijkomt', () => {
    const aangevuld = normalizeOrder(['zuivel', 'brood']);
    expect(aangevuld[0]).toBe('zuivel');
    expect(aangevuld[1]).toBe('brood');
    expect(aangevuld).toHaveLength(defaultProfile().order.length);
    expect(aangevuld).toContain('diepvries');
  });

  it('gooit een categorie weg die niet meer bestaat', () => {
    expect(normalizeOrder(['zuivel', 'bestaat-niet' as 'zuivel'])).not.toContain('bestaat-niet');
  });

  it('zet de boodschappenlijst in de volgorde van de winkel', () => {
    const recept = makeRecipe({
      id: 'z',
      title: 'Z',
      ingredients: [
        { amount: 1, unit: 'stuks', ingredientId: 'ui' },
        { amount: 100, unit: 'ml', ingredientId: 'slagroom' },
      ],
    });
    const lijst = buildShoppingList([{ recipe: recept, servings: 4 }], bibliotheek);
    expect(lijst.map((g) => g.category)).toEqual(['groente-en-fruit', 'zuivel']);

    const opRoute = sortGroupsByStore(lijst, {
      id: 'w1',
      name: 'Mijn winkel',
      order: ['zuivel', 'groente-en-fruit'],
    });
    expect(opRoute.map((g) => g.category)).toEqual(['zuivel', 'groente-en-fruit']);
  });
});
