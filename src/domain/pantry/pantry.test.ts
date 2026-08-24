import { describe, expect, it } from 'vitest';
import { assessRecipe, rankByPantry } from './cook';
import { leadingRoleOnly, rankByIngredient } from './leftovers';
import { daysUntil, findExpiring, type Pantry } from './pantry';
import { applyPantry, effectiveQuantity, stillToBuy, withoutCovered } from './subtract';
import { buildShoppingList } from '../shopping/aggregate';
import { makeRecipe, testLibrary } from '../testing/fixtures';
import { formatQuantity } from '../units/format';

const voorraad = (items: Array<Partial<Pantry[number]> & { ingredientId: string }>): Pantry =>
  items.map((item) => ({ addedAt: '2026-01-01T00:00:00Z', ...item }));

const stoof = makeRecipe({
  id: 'stoof',
  title: 'Stoofpot',
  servings: 4,
  ingredients: [
    { amount: 500, unit: 'g', ingredientId: 'ui' },
    { amount: 2, unit: 'teentje', ingredientId: 'knoflook' },
    { amount: 200, unit: 'ml', ingredientId: 'slagroom' },
    { amount: 1, unit: 'snufje', ingredientId: 'zout', scales: 'taste' },
    { amount: 2, unit: 'stuks', ingredientId: 'laurierblad', optional: true },
  ],
});

describe('voorraad aftrekken van de boodschappenlijst', () => {
  const lijst = (pantry: Pantry) =>
    applyPantry(
      buildShoppingList([{ recipe: stoof, servings: 4 }], testLibrary),
      pantry,
      testLibrary,
    );

  const regel = (pantry: Pantry, label: string) =>
    lijst(pantry)
      .flatMap((g) => g.lines)
      .find((line) => line.label === label);

  it('markeert een regel als gedekt bij aanvinken zonder hoeveelheid', () => {
    const ui = regel(voorraad([{ ingredientId: 'ui' }]), 'uien');
    expect(ui?.stock?.coverage).toBe('volledig');
  });

  it('trekt een hoeveelheid af en laat de rest staan', () => {
    const ui = regel(voorraad([{ ingredientId: 'ui', amount: 200, unit: 'g' }]), 'uien');
    expect(ui?.stock?.coverage).toBe('deels');
    expect(formatQuantity(ui!.stock!.remaining!)).toBe('300 g');
    expect(formatQuantity(effectiveQuantity(ui!)!)).toBe('300 g');
  });

  it('rekent over eenheden heen via de bibliotheek', () => {
    // 2 uien is ongeveer 300 g, dus van de 500 g blijft 200 g over.
    const ui = regel(voorraad([{ ingredientId: 'ui', amount: 2, unit: 'stuks' }]), 'uien');
    expect(ui?.stock?.coverage).toBe('deels');
    expect(formatQuantity(ui!.stock!.remaining!)).toBe('200 g');
  });

  it('dekt de regel als je genoeg hebt', () => {
    const ui = regel(voorraad([{ ingredientId: 'ui', amount: 1, unit: 'kg' }]), 'uien');
    expect(ui?.stock?.coverage).toBe('volledig');
  });

  it('meldt het eerlijk als de eenheden niet te vergelijken zijn', () => {
    const olie = buildShoppingList(
      [
        {
          recipe: makeRecipe({
            id: 'x',
            title: 'X',
            ingredients: [{ amount: 2, unit: 'el', ingredientId: 'olijfolie' }],
          }),
          servings: 4,
        },
      ],
      testLibrary,
    );
    const uit = applyPantry(
      olie,
      voorraad([{ ingredientId: 'olijfolie', amount: 1, unit: 'g' }]),
      testLibrary,
    );
    expect(uit[0]?.lines[0]?.stock?.coverage).toBe('onbekend');
  });

  it('laat gedekte regels zichtbaar, maar houdt ze uit de meeneemlijst', () => {
    const pantry = voorraad([{ ingredientId: 'ui' }, { ingredientId: 'knoflook' }]);
    // Vijf regels: ui, knoflook, slagroom, zout en laurierblad.
    const alles = lijst(pantry).flatMap((g) => g.lines);
    expect(alles).toHaveLength(5);
    expect(stillToBuy(lijst(pantry))).toHaveLength(3);
    expect(withoutCovered(lijst(pantry)).flatMap((g) => g.lines)).toHaveLength(3);
  });

  it('laat de lijst met rust als de voorraadkast leeg is', () => {
    expect(
      lijst([])
        .flatMap((g) => g.lines)
        .every((line) => line.stock === undefined),
    ).toBe(true);
  });
});

describe('wat kan ik nu maken', () => {
  it('telt optionele ingrediënten en "naar smaak" niet als ontbrekend', () => {
    const uitkomst = assessRecipe(
      stoof,
      voorraad([
        { ingredientId: 'ui' },
        { ingredientId: 'knoflook' },
        { ingredientId: 'slagroom' },
      ]),
      testLibrary,
    );
    expect(uitkomst.missing).toHaveLength(0);
    expect(uitkomst.missingOptional).toBe(1);
    expect(uitkomst.toTaste).toBe(1);
    expect(uitkomst.requiredCount).toBe(3);
  });

  it('noemt precies wat je mist', () => {
    const uitkomst = assessRecipe(stoof, voorraad([{ ingredientId: 'ui' }]), testLibrary);
    expect(uitkomst.missing.map((m) => m.label).sort()).toEqual(['knoflook', 'slagroom']);
    expect(uitkomst.haveCount).toBe(1);
  });

  it('rekent te weinig hebben ook als missen', () => {
    const uitkomst = assessRecipe(
      stoof,
      voorraad([
        { ingredientId: 'ui', amount: 100, unit: 'g' },
        { ingredientId: 'knoflook' },
        { ingredientId: 'slagroom' },
      ]),
      testLibrary,
    );
    expect(uitkomst.missing).toHaveLength(1);
    expect(uitkomst.missing[0]?.tooLittle).toBe(true);
  });

  it('zet de gerechten die je helemaal kunt maken bovenaan', () => {
    const soep = makeRecipe({
      id: 'soep',
      title: 'Soep',
      ingredients: [{ amount: 2, unit: 'stuks', ingredientId: 'ui' }],
    });
    const ranglijst = rankByPantry([stoof, soep], voorraad([{ ingredientId: 'ui' }]), testLibrary);
    expect(ranglijst[0]?.recipe.id).toBe('soep');
    expect(ranglijst[0]?.missing).toHaveLength(0);
    expect(ranglijst[1]?.missing).toHaveLength(2);
  });
});

describe('restjesmodus', () => {
  const kooltaart = makeRecipe({
    id: 'kooltaart',
    title: 'Kooltaart',
    ingredients: [
      { amount: 800, unit: 'g', ingredientId: 'ui' },
      { amount: 100, unit: 'ml', ingredientId: 'slagroom' },
    ],
  });
  const bijrol = makeRecipe({
    id: 'bijrol',
    title: 'Iets met een snufje ui',
    ingredients: [
      { amount: 20, unit: 'g', ingredientId: 'ui' },
      { amount: 900, unit: 'g', ingredientId: 'slagroom' },
    ],
  });

  it('zet het recept waarin het ingrediënt een hoofdrol speelt bovenaan', () => {
    const uitkomst = rankByIngredient([bijrol, kooltaart], 'ui', testLibrary);
    expect(uitkomst[0]?.recipe.id).toBe('kooltaart');
    expect(uitkomst[0]?.share).toBeGreaterThan(0.8);
  });

  it('laat bijrollen weg als je alleen hoofdrollen wilt', () => {
    const alleen = leadingRoleOnly(rankByIngredient([bijrol, kooltaart], 'ui', testLibrary));
    expect(alleen.map((m) => m.recipe.id)).toEqual(['kooltaart']);
  });

  it('geeft niets terug voor een ingrediënt dat nergens in zit', () => {
    expect(rankByIngredient([kooltaart], 'laurierblad', testLibrary)).toEqual([]);
  });
});

describe('houdbaarheid', () => {
  const vandaag = new Date('2026-03-10T12:00:00');

  it('telt de dagen tot de datum', () => {
    expect(daysUntil('2026-03-12', vandaag)).toBe(2);
    expect(daysUntil('2026-03-10', vandaag)).toBe(0);
    expect(daysUntil('2026-03-08', vandaag)).toBe(-2);
  });

  it('zet wat het langst over de datum is bovenaan', () => {
    const uit = findExpiring(
      voorraad([
        { ingredientId: 'ui', bestBefore: '2026-03-14' },
        { ingredientId: 'slagroom', bestBefore: '2026-03-08' },
        { ingredientId: 'ei', bestBefore: '2026-03-11' },
        { ingredientId: 'zout', bestBefore: '2026-12-01' },
        { ingredientId: 'knoflook' },
      ]),
      vandaag,
    );
    expect(uit.map((entry) => entry.item.ingredientId)).toEqual(['slagroom', 'ei', 'ui']);
  });
});
