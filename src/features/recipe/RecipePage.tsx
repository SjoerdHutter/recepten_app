import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { removeRecipe } from '../../data/recipes/saveRecipe';
import { ALLERGEN_LABELS, MONTH_LABELS } from '../../domain/schema/enums';
import { activeMinutes, totalMinutes } from '../../domain/schema/recipe';
import { scaleRecipe } from '../../domain/scaling/scale';
import { recipeCost } from '../../domain/store/cost';
import { formatEuro, formatMinutes, formatQuantity } from '../../domain/units/format';
import { cookPath } from '../cook/CookPage';
import { RecipeHistory } from '../history/RecipeHistory';
import { PlanSheet } from '../planner/PlanSheet';
import { AmountSheet } from './AmountSheet';
import { NutritionCard } from './NutritionCard';
import { usePlanner } from '../../state/plannerState';
import { useData, useRecipe } from '../../state/data';
import { useLocalState } from '../../state/localState';
import { useSettings } from '../../state/settings';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { Button, Card, Stepper, Tag } from '../../ui/controls';

const Regel = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-ink-3">{label}</dt>
    <dd className="text-right font-medium">{value}</dd>
  </div>
);

export const RecipePage = () => {
  const { id } = useParams();
  const recipe = useRecipe(id);
  const { library, loading, refresh } = useData();
  const { token, canWrite } = useSettings();
  const { isFavorite, toggleFavorite, overridesFor } = usePlanner();
  const navigate = useNavigate();
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [hoeveelheidRegel, setHoeveelheidRegel] = useState<number | null>(null);
  const [verwijderFout, setVerwijderFout] = useState<string | null>(null);
  const [bezigMetVerwijderen, setBezigMetVerwijderen] = useState(false);
  const {
    selection,
    isSelected,
    toggleSelection,
    setServings: setSelectionServings,
    doneSteps,
  } = useLocalState();

  const uitSelectie = selection.find((entry) => entry.recipeId === id);
  // Aantal afgevinkte stappen, zodat de knop kan zeggen waar je gebleven was.
  const gedaanAantal = id ? doneSteps(id).length : 0;
  const [personen, setPersonen] = useState<number | null>(null);
  const aantal = personen ?? uitSelectie?.servings ?? recipe?.servings ?? 4;

  // Eigen aanpassingen gaan vóór het schalen: ze gelden op het basisaantal
  // personen van het recept, net als de hoeveelheden in het bestand zelf.
  const metAanpassingen = useMemo(() => {
    if (!recipe) return undefined;
    const eigen = overridesFor(recipe.id);
    if (Object.keys(eigen).length === 0) return recipe;
    return {
      ...recipe,
      ingredients: recipe.ingredients.map((regel, index) =>
        eigen[index] !== undefined ? { ...regel, amount: eigen[index] } : regel,
      ),
    };
  }, [recipe, overridesFor]);

  const geschaald = useMemo(
    () => (metAanpassingen ? scaleRecipe(metAanpassingen, aantal, library) : []),
    [metAanpassingen, aantal, library],
  );

  const kosten = useMemo(
    () => (metAanpassingen ? recipeCost(metAanpassingen, library, aantal) : undefined),
    [metAanpassingen, library, aantal],
  );

  if (!recipe) {
    return (
      <div className="py-10 text-center text-ink-2">
        {loading ? 'Bezig met laden…' : 'Dit recept bestaat niet (meer).'}
        <div className="mt-4">
          <Link to="/" className="text-accent">
            Terug naar het overzicht
          </Link>
        </div>
      </div>
    );
  }

  const totaal = totalMinutes(recipe.times);
  const actief = activeMinutes(recipe.times);
  const opDeLijst = isSelected(recipe.id);

  const wijzigAantal = (nieuw: number) => {
    setPersonen(nieuw);
    // Staat het recept al op de lijst, dan schuift de boodschappenlijst mee.
    if (opDeLijst) setSelectionServings(recipe.id, nieuw);
  };

  return (
    <article className="flex flex-col gap-5">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-accent print-hidden">
        <Icon name="terug" className="h-4 w-4" />
        Alle recepten
      </Link>

      <header>
        <div className="flex items-start gap-2">
          <h1 className="flex-1 text-2xl font-semibold leading-tight">{recipe.title}</h1>
          <button
            type="button"
            onClick={() => toggleFavorite(recipe.id)}
            aria-pressed={isFavorite(recipe.id)}
            aria-label={isFavorite(recipe.id) ? 'Uit favorieten halen' : 'Favoriet maken'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl print-hidden ${
              isFavorite(recipe.id) ? 'text-danger' : 'text-ink-3'
            }`}
          >
            {isFavorite(recipe.id) ? '♥' : '♡'}
          </button>
        </div>
        <p className="mt-1.5 text-ink-2">{recipe.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag>
            <Icon name="klok" className="h-3.5 w-3.5" />
            {formatMinutes(totaal)} totaal
          </Tag>
          {totaal !== actief ? <Tag tone="ok">{formatMinutes(actief)} werk</Tag> : null}
          <Tag>{recipe.difficulty}</Tag>
          {recipe.methods.map((method) => (
            <Tag key={method}>{method}</Tag>
          ))}
          {recipe.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        {recipe.allergens.length > 0 ? (
          <p className="mt-2 text-sm text-warn">
            Bevat {recipe.allergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(', ')}.
          </p>
        ) : null}
      </header>

      <div className="flex items-center justify-between gap-3 print-hidden">
        <span className="text-sm font-medium">Aantal personen</span>
        <Stepper value={aantal} onChange={wijzigAantal} label="Aantal personen" />
      </div>

      <section>
        <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
          <span>Ingrediënten</span>
          <span className="text-sm font-normal text-ink-3">voor {aantal} personen</span>
          {kosten && kosten.known > 0 ? (
            <span
              className="text-sm font-normal text-ink-3"
              title={`Schatting op basis van richtprijzen bij ${kosten.known} van de ${kosten.known + kosten.unknown} ingrediënten.`}
            >
              · ± {formatEuro(kosten.perServing)} per portie
            </span>
          ) : null}
        </h2>
        <Card className="divide-y divide-line">
          {geschaald.map((item, index) => (
            <div
              key={`${item.line.ingredientId ?? item.line.name}-${index}`}
              className="flex gap-3 px-4 py-2.5"
            >
              {item.amount !== undefined && item.unit !== undefined ? (
                <button
                  type="button"
                  onClick={() => setHoeveelheidRegel(index)}
                  className={`min-w-16 shrink-0 rounded-md text-right font-semibold tabular-nums print-hidden ${
                    overridesFor(recipe.id)[index] !== undefined
                      ? 'bg-accent-soft px-1 text-accent'
                      : ''
                  }`}
                  aria-label={`Hoeveelheid van ${item.label} aanpassen`}
                >
                  {formatQuantity({ amount: item.amount, unit: item.unit })}
                </button>
              ) : (
                <span className="min-w-16 shrink-0 text-right font-semibold tabular-nums" />
              )}
              <span className="flex-1">
                {item.label}
                {item.line.note ? <span className="text-ink-2">, {item.line.note}</span> : null}
                <span className="ml-1.5 inline-flex gap-1 align-middle">
                  {item.line.optional ? <Tag>optioneel</Tag> : null}
                  {item.line.scales === 'fixed' ? <Tag tone="warn">schaalt niet mee</Tag> : null}
                  {item.line.scales === 'taste' && item.amount === undefined ? (
                    <Tag>naar smaak</Tag>
                  ) : null}
                </span>
              </span>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Bereiding</h2>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <div className="flex-1">
                <p>{step.text}</p>
                {step.timer || step.ovenTemp ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {step.timer ? (
                      <Tag>
                        <Icon name="klok" className="h-3.5 w-3.5" />
                        {formatMinutes(Math.round(step.timer / 60))}
                      </Tag>
                    ) : null}
                    {step.ovenTemp ? (
                      <Tag tone="warn">
                        <Icon name="vuur" className="h-3.5 w-3.5" />
                        {step.ovenTemp} °C
                      </Tag>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Details</h2>
        <Card className="px-4 py-2">
          <dl className="divide-y divide-line">
            <Regel label="Voorbereiden" value={formatMinutes(recipe.times.prep)} />
            <Regel label="Actief koken" value={formatMinutes(recipe.times.active)} />
            {recipe.times.passive > 0 ? (
              <Regel label="Wachten" value={formatMinutes(recipe.times.passive)} />
            ) : null}
            <Regel label="Totaal" value={formatMinutes(totaal)} />
            <Regel label="Pannen en schalen" value={String(recipe.pans)} />
            {recipe.season.length > 0 ? (
              <Regel
                label="Op zijn best in"
                value={recipe.season
                  .map((maand) => MONTH_LABELS[maand - 1] ?? '')
                  .filter(Boolean)
                  .join(', ')}
              />
            ) : null}
            {recipe.source ? (
              <Regel
                label="Bron"
                value={
                  recipe.source.type === 'book'
                    ? `${recipe.source.title}${recipe.source.page ? `, p. ${recipe.source.page}` : ''}`
                    : recipe.source.type === 'url'
                      ? (recipe.source.title ?? recipe.source.url)
                      : recipe.source.text
                }
              />
            ) : null}
          </dl>
        </Card>
        {recipe.notes ? <p className="mt-3 text-sm text-ink-2">{recipe.notes}</p> : null}
      </section>

      <div className="print-hidden">
        <Link
          to={cookPath(recipe.id, aantal)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-on-accent active:brightness-110"
        >
          <Icon name="vuur" className="h-5 w-5" />
          Aan de slag
          {gedaanAantal > 0 ? (
            <span className="rounded-full bg-on-accent/20 px-2 py-0.5 text-xs">
              stap {gedaanAantal + 1}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="flex gap-2 print-hidden">
        <Button
          variant={opDeLijst ? 'secondary' : 'primary'}
          full
          onClick={() => toggleSelection(recipe.id, aantal)}
        >
          <Icon name={opDeLijst ? 'vink' : 'plus'} className="h-4 w-4" />
          {opDeLijst ? 'Staat op de lijst' : 'Op de boodschappenlijst'}
        </Button>
        <Button variant="secondary" onClick={() => setPlanOpen(true)} aria-label="Inplannen">
          <Icon name="lijst" className="h-4 w-4" />
        </Button>
        <Button variant="secondary" onClick={() => window.print()} aria-label="Recept printen">
          <Icon name="printer" className="h-4 w-4" />
        </Button>
      </div>

      {hoeveelheidRegel !== null ? (
        <AmountSheet
          recipe={recipe}
          lineIndex={hoeveelheidRegel}
          servings={aantal}
          onClose={() => setHoeveelheidRegel(null)}
        />
      ) : null}

      {planOpen ? (
        <PlanSheet
          open
          recipeId={recipe.id}
          recipeTitle={recipe.title}
          defaultServings={aantal}
          onClose={() => setPlanOpen(false)}
        />
      ) : null}

      {metAanpassingen ? <NutritionCard recipe={metAanpassingen} servings={aantal} /> : null}

      <RecipeHistory recipeId={recipe.id} recipeTitle={recipe.title} servings={aantal} />

      {canWrite ? (
        <div className="flex gap-2 print-hidden">
          <Button
            variant="secondary"
            full
            onClick={() => navigate(`/recept/${recipe.id}/bewerken`)}
          >
            <Icon name="potlood" className="h-4 w-4" />
            Bewerken
          </Button>
          <Button
            variant="danger"
            onClick={() => setVerwijderOpen(true)}
            aria-label="Recept verwijderen"
          >
            <Icon name="prullenbak" className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <Sheet
        open={verwijderOpen}
        onClose={() => setVerwijderOpen(false)}
        title="Recept verwijderen"
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="ghost" onClick={() => setVerwijderOpen(false)}>
              Annuleren
            </Button>
            <Button
              variant="danger"
              full
              disabled={bezigMetVerwijderen}
              onClick={async () => {
                setBezigMetVerwijderen(true);
                setVerwijderFout(null);
                try {
                  await removeRecipe(recipe, token);
                  await refresh();
                  navigate('/');
                } catch (error) {
                  setVerwijderFout(error instanceof Error ? error.message : 'Verwijderen mislukt.');
                } finally {
                  setBezigMetVerwijderen(false);
                }
              }}
            >
              {bezigMetVerwijderen ? 'Bezig…' : 'Definitief verwijderen'}
            </Button>
          </div>
        }
      >
        <p className="text-ink-2">
          <span className="font-semibold text-ink">{recipe.title}</span> wordt uit de repo
          verwijderd. Het blijft in de git-geschiedenis staan, dus terughalen kan altijd nog.
        </p>
        {verwijderFout ? <p className="mt-3 text-sm text-danger">{verwijderFout}</p> : null}
      </Sheet>
    </article>
  );
};
