import type { IngredientLibrary } from '../ingredients/library';
import type { ShoppingGroup, ShoppingLine } from '../shopping/aggregate';
import { convertToBase } from '../units/convert';
import { roundInUnit } from '../units/round';
import { dimensionOf, fromBase, type Quantity } from '../units/units';
import { pantryIndex, type Pantry } from './pantry';

/**
 * Trekt af wat je al in huis hebt van de boodschappenlijst.
 *
 * Een regel verdwijnt nooit stilletjes: wat je al hebt wordt gemarkeerd en
 * blijft zichtbaar. In de supermarkt wil je kunnen zien dat de app iets heeft
 * weggestreept, want als je je vergist heb je het gerecht straks niet compleet.
 */

export type Coverage =
  /** Je hebt genoeg, dit hoeft niet mee. */
  | 'volledig'
  /** Je hebt een deel; er blijft iets te kopen over. */
  | 'deels'
  /** Je hebt het niet. */
  | 'niet'
  /** Je hebt het wel, maar de eenheden zijn niet te vergelijken. */
  | 'onbekend';

export interface StockInfo {
  coverage: Coverage;
  /** Wat er in de voorraadkast staat, zoals je het daar invulde. */
  have: Quantity | null;
  /** Wat je nog moet kopen; alleen gevuld bij "deels". */
  remaining: Quantity | null;
}

const stockFor = (
  line: ShoppingLine,
  pantry: ReturnType<typeof pantryIndex>,
  library: IngredientLibrary,
): StockInfo | undefined => {
  if (!line.ingredientId) return undefined;
  const item = pantry.get(line.ingredientId);
  if (!item) return undefined;

  // Aangevinkt zonder hoeveelheid: je hebt het, punt.
  if (item.amount === undefined || item.unit === undefined) {
    return { coverage: 'volledig', have: null, remaining: null };
  }

  const have: Quantity = { amount: item.amount, unit: item.unit };
  if (!line.quantity) {
    // Een regel zonder hoeveelheid ("naar smaak") is gedekt zodra je het hebt.
    return { coverage: 'volledig', have, remaining: null };
  }

  const ingredient = library.get(line.ingredientId);
  const dimensie = dimensionOf(line.quantity.unit);
  const nodig = convertToBase(line.quantity.amount, line.quantity.unit, dimensie, ingredient);
  const inHuis = convertToBase(item.amount, item.unit, dimensie, ingredient);

  if (nodig === null || inHuis === null) {
    return { coverage: 'onbekend', have, remaining: null };
  }
  if (inHuis >= nodig) return { coverage: 'volledig', have, remaining: null };

  const restBasis = nodig - inHuis;
  const ruw = fromBase(restBasis, dimensie, line.quantity.unit);
  return {
    coverage: 'deels',
    have,
    remaining: { amount: roundInUnit(ruw.amount, ruw.unit), unit: ruw.unit },
  };
};

/** Zet bij elke regel wat je er al van in huis hebt. */
export const applyPantry = (
  groups: ShoppingGroup[],
  pantry: Pantry,
  library: IngredientLibrary,
): ShoppingGroup[] => {
  if (pantry.length === 0) return groups;
  const index = pantryIndex(pantry);
  return groups.map((group) => ({
    ...group,
    lines: group.lines.map((line) => {
      const stock = stockFor(line, index, library);
      return stock ? { ...line, stock } : line;
    }),
  }));
};

/** Wat er werkelijk gekocht moet worden; voor de teller en de deeltekst. */
export const stillToBuy = (groups: ShoppingGroup[]): ShoppingLine[] =>
  groups.flatMap((group) => group.lines.filter((line) => line.stock?.coverage !== 'volledig'));

/** De lijst zoals je hem meeneemt: gedekte regels eruit. */
export const withoutCovered = (groups: ShoppingGroup[]): ShoppingGroup[] =>
  groups
    .map((group) => ({
      ...group,
      lines: group.lines.filter((line) => line.stock?.coverage !== 'volledig'),
    }))
    .filter((group) => group.lines.length > 0);

/** De hoeveelheid die op de lijst hoort te staan, voorraad meegerekend. */
export const effectiveQuantity = (line: ShoppingLine): Quantity | null =>
  line.stock?.coverage === 'deels' ? line.stock.remaining : line.quantity;
