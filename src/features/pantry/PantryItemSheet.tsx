import { useState } from 'react';
import { daysUntil, formatDays, type PantryItem } from '../../domain/pantry/pantry';
import type { Ingredient } from '../../domain/schema/ingredient';
import { UNITS, type Unit } from '../../domain/units/units';
import { useLocalState, type PantryPatch } from '../../state/localState';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button, Chip } from '../../ui/controls';

/** "1,5" en "1.5" moeten allebei werken; komma is wat je op een telefoon typt. */
const leesGetal = (waarde: string): number | undefined => {
  const schoon = waarde.trim().replace(',', '.');
  if (!schoon) return undefined;
  const getal = Number(schoon);
  return Number.isFinite(getal) && getal > 0 ? getal : undefined;
};

/**
 * Hoeveelheid en houdbaarheid zijn allebei optioneel. Aanvinken dát je iets in
 * huis hebt is het belangrijkste; de rest vul je alleen in als het je iets
 * oplevert, zoals bij een pak room dat volgende week over de datum gaat.
 */
export const PantryItemSheet = ({
  item,
  ingredient,
  onClose,
  onShowRecipes,
}: {
  item: PantryItem | null;
  ingredient: Ingredient | undefined;
  onClose: () => void;
  onShowRecipes: () => void;
}) => {
  const { updatePantryItem, removeFromPantry } = useLocalState();
  const [aantal, setAantal] = useState(
    item?.amount === undefined ? '' : String(item.amount).replace('.', ','),
  );
  const [eenheid, setEenheid] = useState<Unit | ''>(item?.unit ?? ingredient?.defaultUnit ?? '');
  const [datum, setDatum] = useState(item?.bestBefore ?? '');

  if (!item) return null;

  const bewaar = () => {
    const getal = leesGetal(aantal);
    const patch: PantryPatch = {
      amount: getal !== undefined && eenheid ? getal : undefined,
      unit: getal !== undefined && eenheid ? (eenheid as Unit) : undefined,
      bestBefore: datum || undefined,
    };
    updatePantryItem(item.ingredientId, patch);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={ingredient?.name ?? item.ingredientId}
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" full onClick={bewaar}>
            Opslaan
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Hoeveel heb je?</h3>
          <p className="text-xs text-ink-3">
            Mag leeg blijven. Vul je het wel in, dan trekt de boodschappenlijst precies dit af.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={aantal}
              onChange={(event) => setAantal(event.target.value)}
              inputMode="decimal"
              placeholder="Aantal"
              className="h-12 w-24 rounded-xl border border-line bg-surface px-3 tabular-nums"
              aria-label="Hoeveelheid"
            />
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map((optie) => (
                <Chip
                  key={optie}
                  active={eenheid === optie}
                  onClick={() => setEenheid(eenheid === optie ? '' : optie)}
                >
                  {optie}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Houdbaar tot</h3>
          <p className="text-xs text-ink-3">
            Vul dit in bij wat bederft; je krijgt dan op tijd een seintje met receptsuggesties.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={datum}
              onChange={(event) => setDatum(event.target.value)}
              className="h-12 flex-1 rounded-xl border border-line bg-surface px-3"
              aria-label="Houdbaar tot"
            />
            {datum ? (
              <Button variant="ghost" onClick={() => setDatum('')}>
                Wissen
              </Button>
            ) : null}
          </div>
          {datum ? (
            <p className="text-xs text-ink-3">{formatDays(daysUntil(datum, new Date()))}</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <Button onClick={onShowRecipes}>
            <Icon name="boek" className="h-4 w-4" />
            Recepten hiermee
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              removeFromPantry(item.ingredientId);
              onClose();
            }}
          >
            <Icon name="prullenbak" className="h-4 w-4" />
            Uit de voorraadkast halen
          </Button>
        </section>
      </div>
    </Sheet>
  );
};
