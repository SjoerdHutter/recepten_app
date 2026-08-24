import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildSteps, unmentionedIngredients } from '../../domain/cooking/steps';
import { scaleRecipe } from '../../domain/scaling/scale';
import type { TimeMention } from '../../domain/text/timers';
import { formatMinutes, formatQuantity } from '../../domain/units/format';
import { useData, useRecipe } from '../../state/data';
import { useLocalState } from '../../state/localState';
import { useTimers } from '../../state/timers';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/controls';
import { CookLogSheet } from '../history/CookLogSheet';
import { ConvertSheet } from './ConvertSheet';
import { StepText } from './StepText';
import { TimerBar } from './TimerBar';
import { useWakeLock } from './useWakeLock';

/**
 * Kookmodus: één stap tegelijk, groot genoeg om vanaf het aanrecht te lezen,
 * en met het scherm dat aan blijft. Alles is met één natte duim te bedienen.
 */
export const CookPage = () => {
  const { id } = useParams<{ id: string }>();
  const recipe = useRecipe(id);
  const { library } = useData();
  const { doneSteps, toggleStepDone, resetProgress } = useLocalState();
  const { start } = useTimers();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const servings = Number(params.get('personen')) || recipe?.servings || 4;
  const [huidig, setHuidig] = useState(0);
  const [omrekenenOpen, setOmrekenenOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const wakeLock = useWakeLock(true);

  const geschaald = useMemo(
    () => (recipe ? scaleRecipe(recipe, servings, library) : []),
    [recipe, servings, library],
  );
  const stappen = useMemo(() => (recipe ? buildSteps(recipe, geschaald) : []), [recipe, geschaald]);
  const nietGenoemd = useMemo(
    () => unmentionedIngredients(stappen, geschaald),
    [stappen, geschaald],
  );

  if (!recipe) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-2">Dit recept bestaat niet (meer).</p>
        <Link to="/" className="mt-3 inline-block text-accent">
          Terug naar de recepten
        </Link>
      </div>
    );
  }

  const gedaan = doneSteps(recipe.id);
  const stap = stappen[huidig];
  const laatste = huidig === stappen.length - 1;
  const oventemperatuur = recipe.steps.find((s) => s.ovenTemp !== undefined)?.ovenTemp;
  const baktijd = recipe.steps.find((s) => s.timer !== undefined)?.timer;

  const startTimer = (seconden: number, label: string) =>
    start({ seconds: seconden, label, recipeId: recipe.id, stepIndex: huidig });

  const startVanuitTekst = (mention: TimeMention) =>
    startTimer(mention.seconds, `Stap ${huidig + 1}: ${mention.text}`);

  const volgende = () => {
    if (!gedaan.includes(huidig)) toggleStepDone(recipe.id, huidig);
    if (!laatste) setHuidig(huidig + 1);
  };

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/recept/${recipe.id}`)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 active:bg-surface-2"
          aria-label="Kookmodus verlaten"
        >
          <Icon name="terug" />
        </button>
        <div className="flex-1">
          <p className="truncate text-sm font-medium">{recipe.title}</p>
          <p className="text-xs text-ink-3">
            {servings} personen
            {oventemperatuur ? ` · oven ${oventemperatuur} °C` : ''}
            {wakeLock === 'aan' ? ' · scherm blijft aan' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOmrekenenOpen(true)}
          className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-2 active:bg-surface-2"
        >
          <Icon name="vernieuw" className="h-4 w-4" />
          Omrekenen
        </button>
      </header>

      {/* Voortgangsbalkje: elke stap een blokje, het huidige gemarkeerd. */}
      <div className="flex gap-1" aria-label={`Stap ${huidig + 1} van ${stappen.length}`}>
        {stappen.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setHuidig(index)}
            aria-label={`Naar stap ${index + 1}`}
            className={`h-2 flex-1 rounded-full ${
              index === huidig ? 'bg-accent' : gedaan.includes(index) ? 'bg-ok' : 'bg-surface-2'
            }`}
          />
        ))}
      </div>

      {stap ? (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-ink-3">
              Stap {huidig + 1} van {stappen.length}
            </span>
            {gedaan.includes(huidig) ? (
              <span className="text-sm font-medium text-ok">afgevinkt</span>
            ) : null}
          </div>

          {stap.ingredients.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {stap.ingredients.map((item, index) => (
                <li
                  key={`${item.line.ingredientId ?? item.label}-${index}`}
                  className="rounded-xl bg-surface px-3 py-2 text-[15px]"
                >
                  <span className="font-semibold tabular-nums">
                    {item.amount !== undefined && item.unit
                      ? `${formatQuantity({ amount: item.amount, unit: item.unit })} `
                      : ''}
                  </span>
                  {item.label}
                  {item.line.note ? <span className="text-ink-3"> · {item.line.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Groot genoeg om vanaf een halve meter te lezen. */}
          <p className="text-[22px] leading-relaxed">
            <StepText text={stap.step.text} mentions={stap.mentions} onStart={startVanuitTekst} />
          </p>

          <div className="flex flex-wrap gap-2">
            {stap.fieldTimer !== undefined ? (
              <Button
                variant="secondary"
                onClick={() =>
                  startTimer(
                    stap.fieldTimer as number,
                    `Stap ${huidig + 1}: ${formatMinutes(Math.round((stap.fieldTimer as number) / 60))}`,
                  )
                }
              >
                <Icon name="klok" className="h-4 w-4" />
                Timer {formatMinutes(Math.round(stap.fieldTimer / 60))}
              </Button>
            ) : null}
            {stap.step.ovenTemp !== undefined ? (
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-warn-soft px-3 text-sm font-medium text-warn">
                <Icon name="vuur" className="h-4 w-4" />
                Oven {stap.step.ovenTemp} °C
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {huidig === stappen.length - 1 && nietGenoemd.length > 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-3">
          <p className="text-sm font-medium">Nog niet langsgekomen</p>
          <p className="mt-0.5 text-xs text-ink-3">
            Deze ingrediënten worden in geen enkele stap genoemd. Even nakijken of ze ergens bij
            horen.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nietGenoemd.map((item, index) => (
              <li
                key={`${item.line.ingredientId ?? item.label}-${index}`}
                className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
              >
                {item.amount !== undefined && item.unit
                  ? `${formatQuantity({ amount: item.amount, unit: item.unit })} `
                  : ''}
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TimerBar inset={false} />

      <div className="safe-bottom sticky bottom-0 flex gap-2 bg-bg/95 py-3 backdrop-blur">
        <Button
          variant="secondary"
          onClick={() => setHuidig(Math.max(0, huidig - 1))}
          disabled={huidig === 0}
        >
          <Icon name="terug" className="h-5 w-5" />
        </Button>
        {laatste ? (
          <Button
            variant="primary"
            full
            className="min-h-14 text-base"
            onClick={() => {
              if (!gedaan.includes(huidig)) toggleStepDone(recipe.id, huidig);
              // Eerst vragen hoe het ging; pas daarna de voortgang wissen.
              setLogOpen(true);
            }}
          >
            <Icon name="vink" className="h-5 w-5" />
            Klaar met koken
          </Button>
        ) : (
          <Button variant="primary" full className="min-h-14 text-base" onClick={volgende}>
            Volgende stap
            <Icon name="omlaag" className="h-5 w-5 -rotate-90" />
          </Button>
        )}
      </div>

      <CookLogSheet
        open={logOpen}
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        servings={servings}
        onClose={() => {
          setLogOpen(false);
          resetProgress(recipe.id);
          navigate(`/recept/${recipe.id}`);
        }}
      />

      <ConvertSheet
        open={omrekenenOpen}
        onClose={() => setOmrekenenOpen(false)}
        bakeMinutes={baktijd ? Math.round(baktijd / 60) : undefined}
      />
    </div>
  );
};

/** Zodat het receptscherm de kookmodus kan openen met het juiste aantal personen. */
export const cookPath = (recipeId: string, servings: number): string =>
  `/recept/${recipeId}/koken?personen=${servings}`;
