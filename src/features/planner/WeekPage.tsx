import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  entriesForDay,
  isLeftoverDay,
  planToSelections,
  planToText,
  totalServings,
  type PlanEntry,
} from '../../domain/planner/plan';
import {
  addDays,
  dayName,
  formatShort,
  isoWeekNumber,
  startOfWeek,
  weekDays,
} from '../../domain/planner/week';
import { useData } from '../../state/data';
import { useLocalState } from '../../state/localState';
import { today, usePlanner } from '../../state/plannerState';
import { Icon } from '../../ui/Icon';
import { Button, Card, Tag } from '../../ui/controls';
import { PlanEntrySheet } from './PlanEntrySheet';
import { canvasToBlob, renderWeekImage } from './weekImage';

export const WeekPage = () => {
  const { dataset } = useData();
  const { plan, movePlanEntry, clearWeek } = usePlanner();
  const { clearSelection, toggleSelection, setServings } = useLocalState();
  const navigate = useNavigate();

  const [maandag, setMaandag] = useState(() => startOfWeek(today()));
  const [geopend, setGeopend] = useState<string | null>(null);
  const [sleept, setSleept] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  const dagen = useMemo(() => weekDays(maandag), [maandag]);
  const weeknummer = isoWeekNumber(maandag);
  const vandaag = today();

  const titelVoorRecept = (recipeId: string) =>
    dataset.recipes.find((item) => item.id === recipeId)?.title ?? recipeId;

  const entry = plan.find((item) => item.id === geopend) ?? null;
  const aantalGepland = plan.filter((item) => dagen.includes(item.date)).length;

  /** Zet het weekplan als selectie klaar en ga naar de boodschappenlijst. */
  const naarBoodschappen = () => {
    const selecties = planToSelections(plan, dataset.recipes, dagen);
    if (selecties.length === 0) return;
    clearSelection();
    for (const selectie of selecties) {
      toggleSelection(selectie.recipe.id, selectie.servings);
      // toggleSelection bewaart het aantal alleen bij het toevoegen; expliciet
      // zetten dekt ook het geval dat het recept er al stond.
      setServings(selectie.recipe.id, selectie.servings);
    }
    navigate('/lijst');
  };

  const deelTekst = async () => {
    const tekst = planToText(plan, dataset.recipes, dagen, `Weekmenu week ${weeknummer}`);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Weekmenu week ${weeknummer}`, text: tekst });
        return;
      } catch {
        /* weggeklikt */
      }
    }
    try {
      await navigator.clipboard.writeText(tekst);
      setMelding('Weekmenu gekopieerd naar het klembord.');
    } catch {
      setMelding('Kopiëren lukte niet.');
    }
  };

  const deelAfbeelding = async () => {
    const donker = document.documentElement.classList.contains('dark');
    const canvas = renderWeekImage(
      plan,
      dataset.recipes,
      dagen,
      `Weekmenu week ${weeknummer}`,
      donker,
    );
    const blob = await canvasToBlob(canvas);
    if (!blob) {
      setMelding('De afbeelding kon niet gemaakt worden.');
      return;
    }
    const bestand = new File([blob], `weekmenu-week-${weeknummer}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [bestand] }) && navigator.share) {
      try {
        await navigator.share({ files: [bestand], title: `Weekmenu week ${weeknummer}` });
        return;
      } catch {
        /* weggeklikt */
      }
    }
    // Geen deelvenster: dan maar downloaden.
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = bestand.name;
    link.click();
    URL.revokeObjectURL(url);
    setMelding('Afbeelding opgeslagen.');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMaandag(addDays(maandag, -7))}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 active:bg-surface-2"
          aria-label="Vorige week"
        >
          <Icon name="terug" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold">Week {weeknummer}</h1>
          <p className="text-xs text-ink-3">
            {formatShort(dagen[0] as string)} – {formatShort(dagen[6] as string)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMaandag(addDays(maandag, 7))}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 active:bg-surface-2"
          aria-label="Volgende week"
        >
          <Icon name="terug" className="rotate-180" />
        </button>
      </div>

      {maandag !== startOfWeek(vandaag) ? (
        <Button variant="ghost" onClick={() => setMaandag(startOfWeek(vandaag))}>
          Terug naar deze week
        </Button>
      ) : null}

      {melding ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2" role="status">
          {melding}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {dagen.map((dag) => {
          const vanVandaag = entriesForDay(plan, dag);
          const isVandaag = dag === vandaag;
          return (
            <li
              key={dag}
              onDragOver={(event) => {
                if (sleept) event.preventDefault();
              }}
              onDrop={() => {
                if (sleept) movePlanEntry(sleept, dag);
                setSleept(null);
              }}
            >
              <Card
                className={`px-3 py-2.5 ${isVandaag ? 'border-accent' : ''} ${
                  sleept ? 'border-dashed' : ''
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${isVandaag ? 'text-accent' : 'text-ink-2'}`}
                  >
                    {dayName(dag)}
                    {isVandaag ? ' · vandaag' : ''}
                  </span>
                  <span className="text-xs text-ink-3">{formatShort(dag)}</span>
                </div>

                {vanVandaag.length === 0 ? (
                  <p className="py-1.5 text-sm text-ink-3">Nog niets.</p>
                ) : (
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {vanVandaag.map((item: PlanEntry) => {
                      const restje = isLeftoverDay(item, dag);
                      return (
                        <li key={`${item.id}-${dag}`}>
                          <button
                            type="button"
                            draggable={!restje}
                            onDragStart={() => setSleept(item.id)}
                            onDragEnd={() => setSleept(null)}
                            onClick={() => setGeopend(item.id)}
                            className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-surface-2 px-3 text-left active:brightness-95"
                          >
                            <span className="flex-1">
                              <span className="block text-[15px] font-medium">
                                {titelVoorRecept(item.recipeId)}
                              </span>
                              <span className="block text-xs text-ink-3">
                                {restje
                                  ? `van ${dayName(item.date).slice(0, 2)}`
                                  : `${item.servings} personen`}
                                {!restje && item.alsoEatenOn.length > 0
                                  ? ` · kook ${1 + item.alsoEatenOn.length}× (${totalServings(item)} in totaal)`
                                  : ''}
                              </span>
                            </span>
                            {restje ? <Tag tone="ok">restje</Tag> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {aantalGepland === 0 ? (
        <Card className="p-6 text-center">
          <p className="font-medium">Nog niets ingepland.</p>
          <p className="mt-1 text-sm text-ink-2">
            Open een recept en tik op de lijstknop om het op een dag te zetten.
          </p>
          <Link to="/" className="mt-3 inline-block text-accent">
            Naar de recepten
          </Link>
        </Card>
      ) : (
        <>
          <Button variant="primary" full className="min-h-14" onClick={naarBoodschappen}>
            <Icon name="lijst" className="h-5 w-5" />
            Boodschappen voor deze week
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void deelTekst()}>
              <Icon name="delen" className="h-4 w-4" />
              Delen als tekst
            </Button>
            <Button onClick={() => void deelAfbeelding()}>
              <Icon name="delen" className="h-4 w-4" />
              Als afbeelding
            </Button>
            <Button variant="ghost" onClick={() => clearWeek(dagen)}>
              Week leegmaken
            </Button>
          </div>
        </>
      )}

      {/* Verslepen werkt met een muis; op een telefoon verplaats je een gerecht
          via het paneel dat opengaat als je erop tikt. Dat is daar betrouwbaarder
          dan slepen met een vinger over zeven kaarten. */}
      <PlanEntrySheet
        entry={entry}
        recipeTitle={entry ? titelVoorRecept(entry.recipeId) : ''}
        dagen={dagen}
        onClose={() => setGeopend(null)}
      />
    </div>
  );
};
