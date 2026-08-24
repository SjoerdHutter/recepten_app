import { CATEGORY_LABELS } from '../../domain/schema/enums';
import { usePlanner } from '../../state/plannerState';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/controls';

/**
 * Eerdere boodschappenlijsten. Niet om ze opnieuw af te vinken, maar om terug te
 * kunnen kijken: hoeveel kaas kochten we vorige maand ook alweer, en welke
 * gerechten stonden er die week op.
 */
export const ArchiveSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { archive, removeArchived } = usePlanner();

  return (
    <Sheet open={open} onClose={onClose} title="Eerdere lijsten">
      {archive.length === 0 ? (
        <p className="py-8 text-center text-ink-3">
          Nog niets bewaard. Een lijst wordt bewaard zodra je hem afrondt.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {archive.map((lijst) => (
            <li key={lijst.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 font-medium">{lijst.label}</span>
                <span className="text-xs text-ink-3">
                  {new Date(lijst.createdAt).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => removeArchived(lijst.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3"
                  aria-label={`${lijst.label} verwijderen`}
                >
                  <Icon name="kruis" className="h-3.5 w-3.5" />
                </button>
              </div>

              {lijst.recipeTitles.length > 0 ? (
                <p className="mt-0.5 text-xs text-ink-3">{lijst.recipeTitles.join(' · ')}</p>
              ) : null}

              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent">
                  {lijst.lines.length} regels
                </summary>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-sm">
                  {lijst.lines.map((regel, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="min-w-16 shrink-0 text-right tabular-nums text-ink-2">
                        {regel.quantity ?? ''}
                      </span>
                      <span className="flex-1">{regel.label}</span>
                      <span className="text-xs text-ink-3">{CATEGORY_LABELS[regel.category]}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}

      <Button variant="ghost" className="mt-4" full onClick={onClose}>
        Sluiten
      </Button>
    </Sheet>
  );
};
