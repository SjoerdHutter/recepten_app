import { nameVariants, normalizeName } from '../ingredients/library';
import type { Recipe, RecipeStep } from '../schema/recipe';
import type { ScaledIngredient } from '../scaling/scale';
import { findTimeMentions, type TimeMention } from '../text/timers';

/**
 * Zet een recept om in wat de kookmodus per stap nodig heeft: welke
 * ingrediënten erbij horen en welke timers je kunt starten.
 *
 * De ingrediënten worden uit de staptekst gehaald. Het schema heeft er een veld
 * voor (`step` op een ingrediëntregel), maar geen van de recepten gebruikt dat
 * — ze komen uit een kookboek en een Word-document, niet uit een systeem dat
 * die koppeling kende. Wachten tot dat veld ooit ingevuld is zou betekenen dat
 * deze functie jarenlang niets doet, dus wordt er op naam gezocht. Staat het
 * veld er wél, dan wint dat.
 */

export interface StepView {
  /** 0-gebaseerd; de weergave telt zelf vanaf 1. */
  index: number;
  step: RecipeStep;
  ingredients: ScaledIngredient[];
  /** Tijden die in de tekst staan, met hun plek erin. */
  mentions: TimeMention[];
  /** De timer uit het veld, tenzij die al als tijd in de tekst staat. */
  fieldTimer: number | undefined;
}

/** Alle vormen waaronder een ingrediënt in een zin kan staan. */
const vormenVoor = (item: ScaledIngredient): { woorden: Set<string>; zinnen: string[] } => {
  const namen = [
    item.ingredient?.name,
    item.ingredient?.plural,
    ...(item.ingredient?.synonyms ?? []),
    item.line.name,
  ].filter((naam): naam is string => Boolean(naam));

  const woorden = new Set<string>();
  const zinnen: string[] = [];
  for (const naam of namen) {
    for (const vorm of nameVariants(naam)) {
      if (vorm.includes(' ')) zinnen.push(vorm);
      else woorden.add(vorm);
    }
  }
  return { woorden, zinnen };
};

/**
 * Komt dit ingrediënt in deze zin voor? Er wordt vergeleken op hele woorden uit
 * een vaste lijst vormen, niet op "zit deze letterreeks erin". Dat laatste zou
 * "ui" laten matchen op "uiteraard".
 */
const wordtGenoemd = (tekstWoorden: string[], genormaliseerd: string, item: ScaledIngredient) => {
  const { woorden, zinnen } = vormenVoor(item);
  if (zinnen.some((zin) => genormaliseerd.includes(zin))) return true;
  return tekstWoorden.some((woord) => woorden.has(woord));
};

export const buildSteps = (recipe: Recipe, scaled: ScaledIngredient[]): StepView[] => {
  const heeftExplicieteKoppeling = recipe.ingredients.some((line) => line.step !== undefined);

  return recipe.steps.map((step, index) => {
    const genormaliseerd = normalizeName(step.text);
    const tekstWoorden = genormaliseerd.split(' ').filter(Boolean);

    const ingredients = heeftExplicieteKoppeling
      ? scaled.filter((item) => item.line.step === index + 1)
      : scaled.filter((item) => wordtGenoemd(tekstWoorden, genormaliseerd, item));

    const mentions = findTimeMentions(step.text);
    // Staat de tijd van het veld ook in de tekst, dan hoeft er geen tweede
    // knop met dezelfde duur bij.
    const alInTekst = mentions.some(
      (mention) => step.timer !== undefined && Math.abs(mention.seconds - step.timer) <= 60,
    );

    return {
      index,
      step,
      ingredients,
      mentions,
      fieldTimer: step.timer !== undefined && !alInTekst ? step.timer : undefined,
    };
  });
};

/** Ingrediënten die in geen enkele stap genoemd worden; die wil je toch zien. */
export const unmentionedIngredients = (
  steps: StepView[],
  scaled: ScaledIngredient[],
): ScaledIngredient[] => {
  const genoemd = new Set(steps.flatMap((stap) => stap.ingredients.map((item) => item.line)));
  return scaled.filter((item) => !genoemd.has(item.line));
};
