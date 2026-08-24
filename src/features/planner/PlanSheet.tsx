import { useState } from 'react';
import { entriesForDay } from '../../domain/planner/plan';
import { addDays, formatDay, startOfWeek, weekDays } from '../../domain/planner/week';
import { today, usePlanner } from '../../state/plannerState';
import { Sheet } from '../../ui/Sheet';
import { Button, Stepper } from '../../ui/controls';

/**
 * Een gerecht op een dag zetten. Twee weken vooruit is genoeg: verder plan je
 * toch niet, en een langere lijst maakt het kiezen alleen maar lastiger.
 */
export const PlanSheet = ({
  open,
  recipeId,
  recipeTitle,
  defaultServings,
  onClose,
}: {
  open: boolean;
  recipeId: string;
  recipeTitle: string;
  defaultServings: number;
  onClose: () => void;
}) => {
  const { plan, addToPlan } = usePlanner();
  const [personen, setPersonen] = useState(defaultServings);

  const dezeWeek = weekDays(startOfWeek(today()));
  const volgendeWeek = weekDays(addDays(startOfWeek(today()), 7));
  const vandaag = today();

  const dagKnop = (dag: string) => {
    const bezet = entriesForDay(plan, dag).length;
    const verleden = dag < vandaag;
    return (
      <button
        key={dag}
        type="button"
        disabled={verleden}
        onClick={() => {
          addToPlan(recipeId, dag, personen);
          onClose();
        }}
        className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left ${
          verleden
            ? 'border-line bg-surface-2 text-ink-3 opacity-50'
            : 'border-line bg-surface active:bg-surface-2'
        }`}
      >
        <span className="flex-1">
          <span className="block text-sm font-medium">{formatDay(dag)}</span>
          {bezet > 0 ? (
            <span className="block text-xs text-ink-3">
              {bezet === 1 ? 'staat al iets' : `${bezet} gerechten`}
            </span>
          ) : null}
        </span>
        {dag === vandaag ? <span className="text-xs text-accent">vandaag</span> : null}
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="Inplannen">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{recipeTitle}</span> op welke dag?
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Aantal personen</span>
          <Stepper value={personen} onChange={setPersonen} label="Aantal personen" />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Deze week</h3>
          <div className="grid grid-cols-2 gap-2">{dezeWeek.map(dagKnop)}</div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">Volgende week</h3>
          <div className="grid grid-cols-2 gap-2">{volgendeWeek.map(dagKnop)}</div>
        </section>

        <Button variant="ghost" onClick={onClose}>
          Annuleren
        </Button>
      </div>
    </Sheet>
  );
};
