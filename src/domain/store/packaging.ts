import type { Ingredient } from '../schema/ingredient';
import { convertToBase } from '../units/convert';
import { roundInUnit } from '../units/round';
import { dimensionOf, fromBase, type Quantity } from '../units/units';

/**
 * Afronden naar hele verpakkingen. De supermarkt verkoopt geen 150 ml room maar
 * een pak van 250 ml, en dat verschil hoort op je lijst te staan: anders sta je
 * te rekenen in het schap, en achteraf weet je niet meer waarom er een half pak
 * over is.
 */

export interface PackAdvice {
  /** Hoeveel verpakkingen je moet kopen. */
  packs: number;
  packSize: Quantity;
  /** Wat je in totaal in huis haalt. */
  totalBought: Quantity;
  /** Wat er overblijft; ontbreekt als het precies uitkomt. */
  leftover: Quantity | null;
}

export const roundToPackaging = (
  needed: Quantity,
  ingredient: Ingredient | undefined,
): PackAdvice | null => {
  const verpakking = ingredient?.packaging;
  if (!verpakking) return null;

  const dimensie = dimensionOf(verpakking.unit);
  const perPak = convertToBase(verpakking.amount, verpakking.unit, dimensie, ingredient);
  const nodig = convertToBase(needed.amount, needed.unit, dimensie, ingredient);
  if (perPak === null || nodig === null || perPak <= 0) return null;

  const packs = Math.max(1, Math.ceil(nodig / perPak - 0.0001));
  const totaalBasis = packs * perPak;
  const restBasis = totaalBasis - nodig;

  const totaal = fromBase(totaalBasis, dimensie, verpakking.unit);
  const rest = fromBase(restBasis, dimensie, verpakking.unit);

  return {
    packs,
    packSize: { amount: verpakking.amount, unit: verpakking.unit },
    totalBought: { amount: roundInUnit(totaal.amount, totaal.unit), unit: totaal.unit },
    // Een restje van minder dan 2% van een verpakking is meetruis, geen restje.
    leftover:
      restBasis > perPak * 0.02
        ? { amount: roundInUnit(rest.amount, rest.unit), unit: rest.unit }
        : null,
  };
};
