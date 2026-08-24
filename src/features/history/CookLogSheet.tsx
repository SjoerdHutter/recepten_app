import { useState } from 'react';
import type { CookEntry } from '../../domain/history/history';
import { formatDay } from '../../domain/planner/week';
import { today, usePlanner } from '../../state/plannerState';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/controls';

/**
 * Wordt aangeboden zodra je klaar bent met koken. Alles is optioneel: op
 * "Bewaren" drukken zonder iets in te vullen legt gewoon de datum vast. De
 * notitie is het waardevolste veld — "volgende keer de helft van de chili" is
 * precies wat je een half jaar later wilt terugvinden.
 */
export const CookLogSheet = ({
  open,
  recipeTitle,
  recipeId,
  servings,
  bestaand,
  onClose,
}: {
  open: boolean;
  recipeTitle: string;
  recipeId: string;
  servings: number;
  /** Meegeven om een eerdere keer te bewerken in plaats van een nieuwe vast te leggen. */
  bestaand?: CookEntry;
  onClose: () => void;
}) => {
  const { logCooked, updateCookEntry, removeCookEntry } = usePlanner();
  const [datum, setDatum] = useState(bestaand?.cookedAt ?? today());
  const [cijfer, setCijfer] = useState<number | undefined>(bestaand?.rating);
  const [notitie, setNotitie] = useState(bestaand?.note ?? '');

  const bewaar = () => {
    const gegevens = {
      recipeId,
      cookedAt: datum,
      servings: bestaand?.servings ?? servings,
      ...(cijfer !== undefined ? { rating: cijfer } : {}),
      ...(notitie.trim() ? { note: notitie.trim() } : {}),
    };
    if (bestaand) updateCookEntry(bestaand.id, gegevens);
    else logCooked(gegevens);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={bestaand ? 'Kookmoment aanpassen' : 'Gekookt!'}
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Overslaan
          </Button>
          <Button variant="primary" full onClick={bewaar}>
            Bewaren
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{recipeTitle}</span> op {formatDay(datum)}. Alles
          hieronder mag leeg blijven.
        </p>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Wat vond je ervan?</h3>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((waarde) => (
              <button
                key={waarde}
                type="button"
                onClick={() => setCijfer(cijfer === waarde ? undefined : waarde)}
                aria-label={`${waarde} van 5`}
                aria-pressed={cijfer !== undefined && waarde <= cijfer}
                className={`h-14 flex-1 rounded-xl text-2xl ${
                  cijfer !== undefined && waarde <= cijfer
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface-2 text-ink-3'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </section>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Voor de volgende keer</span>
          <textarea
            value={notitie}
            onChange={(event) => setNotitie(event.target.value)}
            rows={3}
            placeholder="Volgende keer de helft van de chili"
            className="min-h-24 rounded-xl border border-line bg-surface p-3"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Wanneer</span>
          <input
            type="date"
            value={datum}
            onChange={(event) => setDatum(event.target.value)}
            className="h-12 rounded-xl border border-line bg-surface px-3"
          />
        </label>

        {bestaand ? (
          <Button
            variant="danger"
            onClick={() => {
              removeCookEntry(bestaand.id);
              onClose();
            }}
          >
            Deze keer verwijderen
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
};
