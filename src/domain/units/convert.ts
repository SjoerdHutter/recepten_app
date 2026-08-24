import type { Ingredient } from '../schema/ingredient';
import { UNIT_INFO, dimensionOf, type Dimension, type Unit } from './units';

/**
 * Rekent een hoeveelheid om naar de basiseenheid van een andere dimensie, met
 * behulp van de omrekenfactoren uit de bibliotheek: 2 uien wordt 300 g omdat
 * daar staat dat 1 ui ongeveer 150 g is. Zonder factor komt er null uit, en dan
 * blijven het twee regels op de boodschappenlijst in plaats van een verkeerde
 * optelling.
 */
export const convertToBase = (
  amount: number,
  unit: Unit,
  target: Dimension,
  ingredient?: Ingredient,
): number | null => {
  if (dimensionOf(unit) === target) return amount * UNIT_INFO[unit].base;

  const vanaf = ingredient?.conversions?.[unit];
  if (vanaf) {
    for (const [naar, factor] of Object.entries(vanaf) as Array<[Unit, number]>) {
      if (dimensionOf(naar) === target) return amount * factor * UNIT_INFO[naar].base;
    }
  }

  // Ook de omgekeerde richting proberen: staat er "1 stuks = 150 g", dan is
  // 300 g ook 2 stuks.
  for (const [van, doelen] of Object.entries(ingredient?.conversions ?? {}) as Array<
    [Unit, Partial<Record<Unit, number>>]
  >) {
    if (dimensionOf(van) !== target) continue;
    const factor = doelen[unit];
    if (factor) return (amount / factor) * UNIT_INFO[van].base;
  }

  return null;
};
