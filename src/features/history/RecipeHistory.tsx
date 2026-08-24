import { useState } from 'react';
import { historyFor, type CookEntry } from '../../domain/history/history';
import { formatDay, relativeDay } from '../../domain/planner/week';
import { today, usePlanner } from '../../state/plannerState';
import { Icon } from '../../ui/Icon';
import { Button, Card } from '../../ui/controls';
import { CookLogSheet } from './CookLogSheet';

const Sterren = ({ waarde }: { waarde: number }) => (
  <span className="text-accent" aria-label={`${waarde} van 5`}>
    {'★'.repeat(waarde)}
    <span className="text-ink-3">{'★'.repeat(5 - waarde)}</span>
  </span>
);

/**
 * Wat je eerder met dit recept deed. De notities zijn het punt: een half jaar
 * later weet je niet meer dat het te pittig was, maar dit wel.
 */
export const RecipeHistory = ({
  recipeId,
  recipeTitle,
  servings,
}: {
  recipeId: string;
  recipeTitle: string;
  servings: number;
}) => {
  const { history } = usePlanner();
  const [bewerken, setBewerken] = useState<CookEntry | null>(null);
  const [nieuwOpen, setNieuwOpen] = useState(false);

  const uit = historyFor(history, recipeId);

  return (
    <section className="print-hidden">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Eerder gemaakt</h2>
        {uit.timesCooked > 0 ? (
          <span className="text-sm text-ink-3">
            {uit.timesCooked}× · laatst {relativeDay(uit.lastCooked as string, today())}
          </span>
        ) : null}
      </div>

      {uit.timesCooked === 0 ? (
        <Card className="px-4 py-3">
          <p className="text-sm text-ink-2">Nog niet gekookt, of je hebt het niet vastgelegd.</p>
          <Button className="mt-2" onClick={() => setNieuwOpen(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Toch vastleggen
          </Button>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-line">
            {uit.entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setBewerken(entry)}
                className="flex w-full flex-col items-start gap-1 px-4 py-2.5 text-left active:bg-surface-2"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{formatDay(entry.cookedAt)}</span>
                  {entry.rating ? <Sterren waarde={entry.rating} /> : null}
                  <Icon name="potlood" className="h-3.5 w-3.5 text-ink-3" />
                </span>
                {entry.note ? <span className="text-sm text-ink-2">{entry.note}</span> : null}
              </button>
            ))}
          </Card>
          <Button className="mt-2" onClick={() => setNieuwOpen(true)}>
            <Icon name="plus" className="h-4 w-4" />
            Nog een keer vastleggen
          </Button>
        </>
      )}

      {nieuwOpen ? (
        <CookLogSheet
          open
          recipeId={recipeId}
          recipeTitle={recipeTitle}
          servings={servings}
          onClose={() => setNieuwOpen(false)}
        />
      ) : null}

      {bewerken ? (
        <CookLogSheet
          open
          recipeId={recipeId}
          recipeTitle={recipeTitle}
          servings={servings}
          bestaand={bewerken}
          onClose={() => setBewerken(null)}
        />
      ) : null}
    </section>
  );
};
