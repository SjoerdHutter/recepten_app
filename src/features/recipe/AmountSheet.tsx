import { useState } from 'react';
import { saveRecipe } from '../../data/recipes/saveRecipe';
import type { Recipe } from '../../domain/schema/recipe';
import { formatQuantity } from '../../domain/units/format';
import { parseAmount } from '../../domain/text/parse';
import { useData } from '../../state/data';
import { usePlanner } from '../../state/plannerState';
import { useSettings } from '../../state/settings';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/controls';

/**
 * Een hoeveelheid bijstellen. Dat gebeurt in twee stappen, en dat onderscheid is
 * met opzet: eerst pas je hem voor jezelf aan (blijft op dit toestel), en pas
 * als je zeker weet dat het altijd zo moet gaat het het receptbestand in.
 *
 * De aanpassing wordt bewaard op het basisaantal personen van het recept, niet
 * op het aantal dat je nu toevallig bekijkt. Anders zou "150 gram" ineens iets
 * anders betekenen zodra je van vier naar zes personen schuift.
 */
export const AmountSheet = ({
  recipe,
  lineIndex,
  servings,
  onClose,
}: {
  recipe: Recipe;
  lineIndex: number | null;
  /** Het aantal personen dat nu op het scherm staat. */
  servings: number;
  onClose: () => void;
}) => {
  const { token, canWrite } = useSettings();
  const { refresh } = useData();
  const { overridesFor, setOverride, clearOverride } = usePlanner();
  const [waarde, setWaarde] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);

  if (lineIndex === null) return null;
  const line = recipe.ingredients[lineIndex];
  if (!line || line.amount === undefined || line.unit === undefined) return null;

  const aangepast = overridesFor(recipe.id)[lineIndex];
  const basis = aangepast ?? line.amount;
  const factor = servings / recipe.servings;
  const ingevuld = waarde.trim() ? parseAmount(waarde) : undefined;

  /** Wat je intypt geldt voor het aantal personen op het scherm; terugrekenen. */
  const nieuwBasis = ingevuld !== undefined && factor > 0 ? ingevuld / factor : undefined;

  const bewaarLokaal = () => {
    if (nieuwBasis === undefined) return;
    setOverride(recipe.id, lineIndex, Number(nieuwBasis.toFixed(4)));
    onClose();
  };

  const zetInRecept = async () => {
    const doel = nieuwBasis ?? aangepast;
    if (doel === undefined || !token) return;
    setBezig(true);
    setFout(null);
    try {
      const bijgewerkt: Recipe = {
        ...recipe,
        ingredients: recipe.ingredients.map((regel, index) =>
          index === lineIndex ? { ...regel, amount: Number(doel.toFixed(4)) } : regel,
        ),
        updatedAt: new Date().toISOString(),
      };
      await saveRecipe({ recipe: bijgewerkt, newIngredients: [], mode: 'update' }, token);
      clearOverride(recipe.id, lineIndex);
      await refresh();
      setKlaar(true);
      onClose();
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Opslaan mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const huidigOpScherm = { amount: Number((basis * factor).toFixed(2)), unit: line.unit };
  const naam = line.name ?? line.ingredientId ?? '';

  return (
    <Sheet open onClose={onClose} title={`Hoeveelheid ${naam}`}>
      <div className="flex flex-col gap-5">
        {fout ? (
          <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{fout}</p>
        ) : null}
        {klaar ? (
          <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm text-ok">
            Het recept is bijgewerkt.
          </p>
        ) : null}

        <p className="text-sm text-ink-2">
          Nu <span className="font-semibold text-ink">{formatQuantity(huidigOpScherm)}</span> voor{' '}
          {servings} personen
          {aangepast !== undefined ? ' (door jou aangepast)' : ''}.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Nieuwe hoeveelheid voor {servings} personen</span>
          <div className="flex items-center gap-2">
            <input
              value={waarde}
              onChange={(event) => setWaarde(event.target.value)}
              inputMode="decimal"
              placeholder={String(huidigOpScherm.amount).replace('.', ',')}
              className="h-12 flex-1 rounded-xl border border-line bg-surface px-3 tabular-nums"
              autoFocus
            />
            <span className="text-ink-2">{line.unit}</span>
          </div>
        </label>

        <div className="flex flex-col gap-2">
          <Button variant="primary" disabled={nieuwBasis === undefined} onClick={bewaarLokaal}>
            Alleen voor mij bewaren
          </Button>
          <Button
            disabled={(nieuwBasis === undefined && aangepast === undefined) || !canWrite || bezig}
            onClick={() => void zetInRecept()}
          >
            {bezig ? 'Bezig…' : 'Altijd zo: in het recept zetten'}
          </Button>
          {!canWrite ? (
            <p className="text-xs text-ink-3">
              Het recept aanpassen kan alleen met een token met schrijfrechten.
            </p>
          ) : null}
          {aangepast !== undefined ? (
            <Button
              variant="ghost"
              onClick={() => {
                clearOverride(recipe.id, lineIndex);
                onClose();
              }}
            >
              Terug naar {formatQuantity({ amount: line.amount * factor, unit: line.unit })}
            </Button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
};
