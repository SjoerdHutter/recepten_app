import { BETROUWBAAR_VANAF, coverage, recipeNutrition } from '../../domain/nutrition/nutrition';
import type { Recipe } from '../../domain/schema/recipe';
import { formatNumber } from '../../domain/units/format';
import { useData } from '../../state/data';
import { Card } from '../../ui/controls';

/**
 * Voedingswaarde per portie.
 *
 * Dit is een indicatie en geen voedingsadvies, en dat staat er ook. De cijfers
 * komen uit richtwaarden per 100 g voor een gemiddeld product, opgeteld over de
 * ingrediënten. Er staat altijd bij hoeveel er meegerekend kon worden: een
 * getal zonder die dekking doet alsof het gemeten is.
 */

const Regel = ({
  label,
  waarde,
  eenheid,
  nadruk = false,
}: {
  label: string;
  waarde: number;
  eenheid: string;
  nadruk?: boolean;
}) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5">
    <span className={nadruk ? 'font-medium' : 'text-ink-2'}>{label}</span>
    <span className={`tabular-nums ${nadruk ? 'font-semibold' : ''}`}>
      {formatNumber(waarde, waarde < 10 ? 1 : 0)} {eenheid}
    </span>
  </div>
);

export const NutritionCard = ({ recipe, servings }: { recipe: Recipe; servings: number }) => {
  const { library } = useData();
  const uit = recipeNutrition(recipe, library, servings);
  const dekking = coverage(uit);

  if (uit.known === 0) {
    return (
      <section className="print-hidden">
        <h2 className="mb-2 text-lg font-semibold">Voedingswaarde</h2>
        <Card className="px-4 py-3">
          <p className="text-sm text-ink-2">
            Van geen van de ingrediënten zijn gegevens bekend, dus hier valt niets te berekenen.
          </p>
        </Card>
      </section>
    );
  }

  const perPortie = uit.perServing;
  const betrouwbaar = dekking >= BETROUWBAAR_VANAF;

  return (
    <section className="print-hidden">
      <h2 className="mb-2 text-lg font-semibold">
        Voedingswaarde <span className="text-sm font-normal text-ink-3">per portie</span>
      </h2>
      <Card className="px-4 py-2">
        <div className="divide-y divide-line">
          <Regel label="Energie" waarde={perPortie.kcal} eenheid="kcal" nadruk />
          <Regel label="Eiwit" waarde={perPortie.protein} eenheid="g" />
          <Regel label="Koolhydraten" waarde={perPortie.carbs} eenheid="g" />
          <Regel label="Vet" waarde={perPortie.fat} eenheid="g" />
          <Regel label="Vezels" waarde={perPortie.fiber} eenheid="g" />
          <Regel label="Zout" waarde={perPortie.salt} eenheid="g" />
        </div>

        <div className="mt-2 border-t border-line pt-2 text-xs text-ink-3">
          <p>
            {betrouwbaar
              ? `Berekend over ${Math.round(dekking * 100)}% van het gewogen deel`
              : `Let op: maar ${Math.round(dekking * 100)}% van het gewicht kon meegerekend worden`}
            {uit.unknown > 0
              ? `; ${uit.unknown} ${uit.unknown === 1 ? 'ingrediënt weegt mee maar heeft' : 'ingrediënten wegen mee maar hebben'} geen gegevens`
              : ''}
            .
            {uit.unweighable > 0
              ? ` ${uit.unweighable} ${uit.unweighable === 1 ? 'ingrediënt valt' : 'ingrediënten vallen'} er helemaal buiten, zoals kruiden en wat naar smaak gaat.`
              : ''}
            {uit.assumedDensity > 0
              ? ` Bij ${uit.assumedDensity} ${uit.assumedDensity === 1 ? 'regel' : 'regels'} is 1 gram per milliliter aangenomen.`
              : ''}
          </p>
          <p className="mt-1">
            Richtwaarden voor een gemiddeld product
            {uit.oldestDate ? `, bijgewerkt ${uit.oldestDate}` : ''}.{' '}
            <span className="font-medium text-ink-2">
              Dit is een indicatie en geen voedingsadvies.
            </span>
          </p>
        </div>
      </Card>
    </section>
  );
};
