import { isLeftoverDay, totalServings, type PlanEntry } from '../../domain/planner/plan';
import { dayNameShort, formatDay, type DateKey } from '../../domain/planner/week';
import { usePlanner } from '../../state/plannerState';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button, Stepper } from '../../ui/controls';

/**
 * Wat je met een ingepland gerecht kunt: verplaatsen, het aantal personen
 * bijstellen, of er een tweede eetdag bij zetten.
 *
 * Dat laatste is het punt van deze hele planner: "kook 2×, eet dinsdag en
 * donderdag" moet de boodschappen verdubbelen zonder dat het gerecht twee keer
 * op je weekmenu komt te staan.
 */
export const PlanEntrySheet = ({
  entry,
  recipeTitle,
  dagen,
  onClose,
}: {
  entry: PlanEntry | null;
  recipeTitle: string;
  dagen: DateKey[];
  onClose: () => void;
}) => {
  const { movePlanEntry, setPlanServings, toggleExtraDay, removeFromPlan } = usePlanner();
  if (!entry) return null;

  const extraDagen = entry.alsoEatenOn.length;

  return (
    <Sheet open onClose={onClose} title={recipeTitle}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Personen per maaltijd</span>
          <Stepper
            value={entry.servings}
            onChange={(waarde) => setPlanServings(entry.id, waarde)}
            label="Personen per maaltijd"
          />
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Kookdag</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {dagen.map((dag) => (
              <button
                key={dag}
                type="button"
                onClick={() => movePlanEntry(entry.id, dag)}
                aria-pressed={entry.date === dag}
                className={`min-h-12 rounded-xl text-sm font-medium ${
                  entry.date === dag ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2'
                }`}
              >
                {dayNameShort(dag)}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Ook eten op</h3>
          <p className="text-xs text-ink-3">
            Kies extra dagen om van dezelfde pan te eten. De boodschappen worden dan groter, maar
            het gerecht blijft één regel op je weekmenu.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {dagen.map((dag) => {
              const isKookdag = dag === entry.date;
              const gekozen = entry.alsoEatenOn.includes(dag);
              return (
                <button
                  key={dag}
                  type="button"
                  disabled={isKookdag}
                  onClick={() => toggleExtraDay(entry.id, dag)}
                  aria-pressed={gekozen}
                  className={`min-h-12 rounded-xl text-sm font-medium ${
                    isKookdag
                      ? 'bg-surface-2 text-ink-3 opacity-40'
                      : gekozen
                        ? 'bg-ok text-white'
                        : 'bg-surface-2 text-ink-2'
                  }`}
                >
                  {dayNameShort(dag)}
                </button>
              );
            })}
          </div>
          {extraDagen > 0 ? (
            <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
              Koken op {formatDay(entry.date)} voor {totalServings(entry)} personen; daarna eet je
              nog op{' '}
              {entry.alsoEatenOn
                .filter((dag) => isLeftoverDay(entry, dag))
                .map(dayNameShort)
                .join(' en ')}
              .
            </p>
          ) : null}
        </section>

        <Button
          variant="danger"
          onClick={() => {
            removeFromPlan(entry.id);
            onClose();
          }}
        >
          <Icon name="prullenbak" className="h-4 w-4" />
          Uit het weekmenu halen
        </Button>
      </div>
    </Sheet>
  );
};
