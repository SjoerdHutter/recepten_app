import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { newFileUrl } from '../../config';
import { kvGet, kvSet } from '../../data/db/idb';
import { resizeToWebp, type ResizedImage } from '../../data/images/resize';
import { enqueueDraft } from '../../data/queue/draftQueue';
import { saveRecipe, type SavePayload } from '../../data/recipes/saveRecipe';
import { ConflictError } from '../../data/github/write';
import { recipeToYaml } from '../../data/serialize/recipeYaml';
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  DIFFICULTIES,
  METHODS,
  MONTH_LABELS,
  SUGGESTED_TAGS,
} from '../../domain/schema/enums';
import type { Allergen, Difficulty, Method } from '../../domain/schema/enums';
import type { Ingredient } from '../../domain/schema/ingredient';
import {
  findSimilarRecipes,
  recipeIngredientIdSet,
  type SimilarMatch,
} from '../../domain/recipes/similar';
import type { Recipe } from '../../domain/schema/recipe';
import type { ParsedRecipe } from '../../domain/text/parse';
import { useData, useRecipe } from '../../state/data';
import { useSettings } from '../../state/settings';
import { Icon } from '../../ui/Icon';
import { Button, Card, Chip } from '../../ui/controls';
import { IngredientRows } from './IngredientRows';
import { PasteSheet } from './PasteSheet';
import { WebImportSheet } from './WebImportSheet';
import { StepRows } from './StepRows';
import {
  draftFromRecipe,
  draftToRecipe,
  emptyDraft,
  imagePathFor,
  legeStap,
  nieuweSleutel,
  slugify,
  type RecipeDraft,
} from './draft';

const CONCEPT_KEY = 'formulier.concept';

const BLOKKEN = ['Basis', 'Tijd en vorm', 'Ingrediënten', 'Stappen', 'Kenmerken', 'Opslaan'];

const Veld = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-semibold">{label}</span>
    {children}
    {hint ? <span className="text-xs text-ink-3">{hint}</span> : null}
  </label>
);

const wissel = <T,>(lijst: T[], waarde: T): T[] =>
  lijst.includes(waarde) ? lijst.filter((entry) => entry !== waarde) : [...lijst, waarde];

/**
 * Een receptensite levert tientallen trefwoorden mee ("easy weeknight dinner",
 * "30 minute meals"). Daarvan is alleen bruikbaar wat de app al als tag kent —
 * de rest zou het filterscherm vervuilen met eenmalige Engelse termen.
 */
const bruikbareTag = (tag: string): boolean => (SUGGESTED_TAGS as readonly string[]).includes(tag);

/**
 * Het formulier krijgt het bestaande recept als prop en zet zijn beginstand in
 * de useState-initialisatie. Zo hoeft er geen effect te zijn dat state overschrijft
 * zodra de gegevens binnen zijn.
 */
const RecipeForm = ({ bestaand }: { bestaand: Recipe | undefined }) => {
  const navigate = useNavigate();
  const id = bestaand?.id;
  const { dataset, library, refresh, online } = useData();
  const { token, canWrite, defaultServings, canImportUrl, canImportPhoto } = useSettings();

  const [draft, setDraft] = useState<RecipeDraft>(() =>
    bestaand ? draftFromRecipe(bestaand) : emptyDraft(defaultServings),
  );
  const [nieuweIngredienten, setNieuweIngredienten] = useState<Ingredient[]>([]);
  const [foto, setFoto] = useState<ResizedImage | null>(null);
  const [blok, setBlok] = useState(0);
  const [fouten, setFouten] = useState<string[]>([]);
  const [gelijkend, setGelijkend] = useState<SimilarMatch[]>([]);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<{ commitUrl: string; wachtrij: boolean } | null>(null);
  const [plakOpen, setPlakOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerijRef = useRef<HTMLInputElement>(null);
  const bewerken = Boolean(id);

  // Bij een nieuw recept het concept terughalen dat nog in de opslag stond.
  useEffect(() => {
    if (bestaand) return;
    let afgebroken = false;
    void kvGet<RecipeDraft>(CONCEPT_KEY).then((bewaard) => {
      if (!afgebroken && bewaard?.title) setDraft(bewaard);
    });
    return () => {
      afgebroken = true;
    };
  }, [bestaand]);

  // Een half ingevuld formulier mag niet verdwijnen als de app opnieuw laadt.
  useEffect(() => {
    if (bewerken) return;
    const timer = window.setTimeout(
      () => void kvSet(CONCEPT_KEY, draft).catch(() => undefined),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [draft, bewerken]);

  const recipeId = draft.id || slugify(draft.title);
  const uitkomst = useMemo(
    () =>
      draftToRecipe({
        ...draft,
        id: recipeId,
        image: foto ? imagePathFor(recipeId) : draft.image,
      }),
    [draft, recipeId, foto],
  );
  const voorbeeld = uitkomst.recipe ? recipeToYaml(uitkomst.recipe) : null;
  const ontbreekt = uitkomst.recipe ? [] : uitkomst.errors;

  const kiesFoto = async (bestand: File | undefined) => {
    if (!bestand) return;
    try {
      setFoto(await resizeToWebp(bestand));
    } catch (error) {
      setFouten([error instanceof Error ? error.message : 'De foto kon niet verwerkt worden.']);
    }
  };

  /**
   * Wat een plakactie of een import oplevert, in het formulier zetten. Alle
   * drie de routes komen hier uit, want daarna is het werk hetzelfde: nalopen
   * en opslaan. Velden die de bron niet gevonden heeft blijven staan zoals ze
   * stonden, zodat een import nooit iets wist wat je al had ingevuld.
   */
  const neemOver = (parsed: ParsedRecipe, gevondenFoto?: ResizedImage) => {
    setDraft((huidig) => ({
      ...huidig,
      title: parsed.title === 'Naamloos recept' ? huidig.title : parsed.title,
      description: parsed.description ?? huidig.description,
      servings: parsed.servings ? String(parsed.servings) : huidig.servings,
      prep: parsed.times.prep ? String(parsed.times.prep) : huidig.prep,
      active: parsed.times.active ? String(parsed.times.active) : huidig.active,
      passive: parsed.times.passive ? String(parsed.times.passive) : huidig.passive,
      ingredients:
        parsed.ingredients.length > 0
          ? parsed.ingredients.map((regel) => ({
              key: nieuweSleutel(),
              amount: regel.amount === undefined ? '' : String(regel.amount).replace('.', ','),
              unit: regel.unit ?? '',
              ...(regel.ingredientId ? { ingredientId: regel.ingredientId } : {}),
              name: regel.name,
              note: regel.note ?? '',
              scales: regel.scales ?? 'linear',
              optional: false,
            }))
          : huidig.ingredients,
      steps:
        parsed.steps.length > 0
          ? parsed.steps.map((tekst, index) => ({
              ...legeStap(),
              text: tekst,
              ovenTemp: parsed.ovenTemps?.[index] ? String(parsed.ovenTemps[index]) : '',
            }))
          : huidig.steps,
      // Alleen tags die de app al kent; de rest van wat een site meelevert is
      // zoekmachinevoer en hoort niet als filter in de bibliotheek te belanden.
      tags: parsed.tags?.length
        ? [...new Set([...huidig.tags, ...parsed.tags.filter(bruikbareTag)])]
        : huidig.tags,
      source: parsed.source ?? huidig.source,
    }));
    if (gevondenFoto) setFoto(gevondenFoto);
    setBlok(0);
  };

  const opslaan = async (negeerGelijkenis = false) => {
    setFouten([]);
    if (!uitkomst.recipe) {
      setFouten(uitkomst.errors);
      return;
    }
    const recept = uitkomst.recipe;

    if (!bewerken && !negeerGelijkenis) {
      const treffers = findSimilarRecipes(
        { id: recept.id, title: recept.title, ingredientIds: recipeIngredientIdSet(recept) },
        dataset.recipes,
      );
      if (treffers.length > 0) {
        setGelijkend(treffers);
        return;
      }
    }
    setGelijkend([]);

    const payload: SavePayload = {
      recipe: recept,
      newIngredients: nieuweIngredienten,
      ...(foto ? { image: { bytes: Array.from(foto.bytes), path: imagePathFor(recept.id) } } : {}),
      mode: bewerken ? 'update' : 'create',
    };

    setBezig(true);
    try {
      if (!online) {
        await enqueueDraft(payload);
        setKlaar({ commitUrl: '', wachtrij: true });
      } else {
        const resultaat = await saveRecipe(payload, token);
        setKlaar({ commitUrl: resultaat.commitUrl, wachtrij: false });
      }
      if (!bewerken) await kvSet(CONCEPT_KEY, emptyDraft(defaultServings));
      await refresh();
    } catch (error) {
      if (error instanceof ConflictError) {
        setFouten([
          `${error.message} Druk op Vernieuwen in de instellingen en open het recept opnieuw.`,
        ]);
      } else {
        setFouten([error instanceof Error ? error.message : 'Opslaan mislukt.']);
      }
    } finally {
      setBezig(false);
    }
  };

  if (klaar) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Icon name="vink" className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-semibold">
          {klaar.wachtrij
            ? 'Bewaard als concept'
            : bewerken
              ? 'Recept bijgewerkt'
              : 'Recept opgeslagen'}
        </h1>
        <p className="max-w-sm text-ink-2">
          {klaar.wachtrij
            ? 'Je bent offline. Zodra je weer verbinding hebt zet de app dit recept vanzelf in de repo.'
            : 'Het staat nu in de repo en in de app.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={() => navigate(`/recept/${recipeId}`)}>
            Naar het recept
          </Button>
          {klaar.commitUrl ? (
            <a
              href={klaar.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm"
            >
              Commit bekijken
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Link to={bewerken ? `/recept/${id}` : '/'} className="text-sm text-accent">
            Annuleren
          </Link>
          <span className="text-xs text-ink-3">
            Stap {blok + 1} van {BLOKKEN.length}
          </span>
        </div>
        <h1 className="text-xl font-semibold">{BLOKKEN[blok]}</h1>
        <div className="flex gap-1" aria-hidden="true">
          {BLOKKEN.map((naam, index) => (
            <span
              key={naam}
              className={`h-1 flex-1 rounded-full ${index <= blok ? 'bg-accent' : 'bg-surface-2'}`}
            />
          ))}
        </div>
      </header>

      {blok === 0 ? (
        <div className="flex flex-col gap-4">
          {!bewerken ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" full onClick={() => setPlakOpen(true)}>
                <Icon name="kopieer" className="h-4 w-4" />
                Een heel recept plakken
              </Button>
              {canImportUrl || canImportPhoto ? (
                <Button variant="secondary" full onClick={() => setImportOpen(true)}>
                  <Icon name="omlaag" className="h-4 w-4" />
                  {canImportUrl && canImportPhoto
                    ? 'Importeren van een site of foto'
                    : canImportUrl
                      ? 'Importeren vanaf een website'
                      : 'Importeren vanaf een foto'}
                </Button>
              ) : null}
            </div>
          ) : null}
          <Veld label="Titel">
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Bijvoorbeeld Uiensoep met kaaskorst"
              className="h-12 rounded-xl border border-line bg-surface px-3"
            />
          </Veld>
          <Veld label="Korte omschrijving" hint="Eén of twee zinnen, dit staat op de kaart.">
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={3}
              className="rounded-xl border border-line bg-surface p-3"
            />
          </Veld>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Foto</h2>
            {foto ? (
              <div className="flex items-center gap-3">
                <img src={foto.previewUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
                <div className="text-sm text-ink-2">
                  <p>
                    {foto.width} bij {foto.height} pixels
                  </p>
                  <button
                    type="button"
                    onClick={() => setFoto(null)}
                    className="mt-1 min-h-9 text-accent"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                  Foto maken
                </Button>
                <Button variant="secondary" onClick={() => galerijRef.current?.click()}>
                  Kiezen
                </Button>
              </div>
            )}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => void kiesFoto(event.target.files?.[0])}
            />
            <input
              ref={galerijRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void kiesFoto(event.target.files?.[0])}
            />
          </div>
        </div>
      ) : null}

      {blok === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Veld label="Snijden">
              <input
                value={draft.prep}
                onChange={(event) => setDraft({ ...draft, prep: event.target.value })}
                inputMode="numeric"
                placeholder="15"
                className="h-12 rounded-xl border border-line bg-surface px-3 tabular-nums"
              />
            </Veld>
            <Veld label="Koken">
              <input
                value={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.value })}
                inputMode="numeric"
                placeholder="20"
                className="h-12 rounded-xl border border-line bg-surface px-3 tabular-nums"
              />
            </Veld>
            <Veld label="Wachten">
              <input
                value={draft.passive}
                onChange={(event) => setDraft({ ...draft, passive: event.target.value })}
                inputMode="numeric"
                placeholder="0"
                className="h-12 rounded-xl border border-line bg-surface px-3 tabular-nums"
              />
            </Veld>
          </div>
          <p className="-mt-2 text-xs text-ink-3">
            Alles in minuten. &ldquo;Wachten&rdquo; is de tijd dat je er niet bij hoeft te staan,
            zoals stoven, rijzen of de oven.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Veld label="Voor hoeveel personen">
              <input
                value={draft.servings}
                onChange={(event) => setDraft({ ...draft, servings: event.target.value })}
                inputMode="numeric"
                className="h-12 rounded-xl border border-line bg-surface px-3 tabular-nums"
              />
            </Veld>
            <Veld label="Pannen en schalen">
              <input
                value={draft.pans}
                onChange={(event) => setDraft({ ...draft, pans: event.target.value })}
                inputMode="numeric"
                className="h-12 rounded-xl border border-line bg-surface px-3 tabular-nums"
              />
            </Veld>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Bereidingswijze</h2>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => (
                <Chip
                  key={method}
                  active={draft.methods.includes(method)}
                  onClick={() =>
                    setDraft({ ...draft, methods: wissel<Method>(draft.methods, method) })
                  }
                >
                  {method}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Moeilijkheid</h2>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((niveau) => (
                <Chip
                  key={niveau}
                  active={draft.difficulty === niveau}
                  onClick={() => setDraft({ ...draft, difficulty: niveau as Difficulty })}
                >
                  {niveau}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {blok === 2 ? (
        <IngredientRows
          regels={draft.ingredients}
          library={library}
          onChange={(regels) => setDraft({ ...draft, ingredients: regels })}
          onCreateIngredient={(ingredient) =>
            setNieuweIngredienten((huidig) =>
              huidig.some((i) => i.id === ingredient.id) ? huidig : [...huidig, ingredient],
            )
          }
        />
      ) : null}

      {blok === 3 ? (
        <StepRows
          stappen={draft.steps}
          onChange={(stappen) => setDraft({ ...draft, steps: stappen })}
        />
      ) : null}

      {blok === 4 ? (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...SUGGESTED_TAGS, ...dataset.recipes.flatMap((r) => r.tags)])]
                .sort((a, b) => a.localeCompare(b, 'nl'))
                .map((tag) => (
                  <Chip
                    key={tag}
                    active={draft.tags.includes(tag)}
                    onClick={() => setDraft({ ...draft, tags: wissel(draft.tags, tag) })}
                  >
                    {tag}
                  </Chip>
                ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Allergenen</h2>
            <p className="mb-2 text-xs text-ink-3">
              Kies wat er echt in zit. Hierop kun je later hard filteren.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((allergeen) => (
                <Chip
                  key={allergeen}
                  active={draft.allergens.includes(allergeen)}
                  onClick={() =>
                    setDraft({ ...draft, allergens: wissel<Allergen>(draft.allergens, allergeen) })
                  }
                >
                  {ALLERGEN_LABELS[allergeen]}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Op zijn best in</h2>
            <div className="flex flex-wrap gap-2">
              {MONTH_LABELS.map((maand, index) => (
                <Chip
                  key={maand}
                  active={draft.season.includes(index + 1)}
                  onClick={() => setDraft({ ...draft, season: wissel(draft.season, index + 1) })}
                >
                  {maand.slice(0, 3)}
                </Chip>
              ))}
            </div>
          </div>

          <Veld label="Bron" hint="Een website, een kookboek of gewoon waar je het vandaan hebt.">
            <input
              value={
                draft.source?.type === 'text'
                  ? draft.source.text
                  : draft.source?.type === 'url'
                    ? draft.source.url
                    : (draft.source?.title ?? '')
              }
              onChange={(event) => {
                const waarde = event.target.value.trim();
                setDraft({
                  ...draft,
                  source: !waarde
                    ? undefined
                    : /^https?:\/\//.test(waarde)
                      ? { type: 'url', url: waarde }
                      : { type: 'text', text: waarde },
                });
              }}
              className="h-12 rounded-xl border border-line bg-surface px-3"
            />
          </Veld>

          <Veld label="Notities">
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={3}
              className="rounded-xl border border-line bg-surface p-3"
            />
          </Veld>
        </div>
      ) : null}

      {blok === 5 ? (
        <div className="flex flex-col gap-4">
          {nieuweIngredienten.length > 0 ? (
            <Card className="px-4 py-3">
              <p className="text-sm font-medium">
                {nieuweIngredienten.length} nieuwe ingrediënten gaan mee naar de bibliotheek
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {nieuweIngredienten.map((i) => i.name).join(', ')}
              </p>
            </Card>
          ) : null}

          {gelijkend.length > 0 ? (
            <Card className="border-warn/40 bg-warn-soft px-4 py-3">
              <p className="text-sm font-semibold text-warn">
                Lijkt dit niet op iets dat er al staat?
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-warn">
                {gelijkend.slice(0, 3).map((match) => (
                  <li key={match.recipe.id}>
                    <Link to={`/recept/${match.recipe.id}`} className="underline">
                      {match.recipe.title}
                    </Link>{' '}
                    &mdash; {match.reason}
                  </li>
                ))}
              </ul>
              <Button className="mt-2" variant="secondary" onClick={() => void opslaan(true)}>
                Toch opslaan
              </Button>
            </Card>
          ) : null}

          {(fouten.length > 0 ? fouten : ontbreekt).length > 0 ? (
            <Card className="border-danger/40 bg-danger-soft px-4 py-3">
              <p className="text-sm font-semibold text-danger">Dit moet er nog gebeuren:</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm text-danger">
                {(fouten.length > 0 ? fouten : ontbreekt).map((fout) => (
                  <li key={fout}>{fout}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {canWrite ? (
            <Button
              variant="primary"
              full
              disabled={bezig || ontbreekt.length > 0}
              onClick={() => void opslaan()}
            >
              {bezig
                ? 'Bezig met opslaan…'
                : online
                  ? bewerken
                    ? 'Wijzigingen opslaan'
                    : 'Opslaan in de repo'
                  : 'Bewaren als concept'}
            </Button>
          ) : (
            <Card className="flex flex-col gap-3 px-4 py-3">
              <p className="text-sm text-ink-2">
                Je zit in leesmodus. Hieronder staat het complete bestand: kopieer het en plak het
                in GitHub, of vul een token in bij de instellingen.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={!voorbeeld}
                  onClick={() => void navigator.clipboard.writeText(voorbeeld ?? '')}
                >
                  <Icon name="kopieer" className="h-4 w-4" />
                  Kopiëren
                </Button>
                {voorbeeld ? (
                  <a
                    href={newFileUrl(`data/recipes/${recipeId}.yaml`, voorbeeld)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm"
                  >
                    Openen in GitHub
                  </a>
                ) : null}
                <Link
                  to="/instellingen"
                  className="inline-flex min-h-11 items-center px-2 text-sm text-accent"
                >
                  Token invullen
                </Link>
              </div>
            </Card>
          )}

          {voorbeeld ? (
            <details>
              <summary className="cursor-pointer text-sm text-ink-3">Het bestand bekijken</summary>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-3 text-xs">
                {voorbeeld}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        {blok > 0 ? (
          <Button variant="secondary" onClick={() => setBlok(blok - 1)}>
            Vorige
          </Button>
        ) : null}
        {blok < BLOKKEN.length - 1 ? (
          <Button variant="primary" full onClick={() => setBlok(blok + 1)}>
            Volgende
          </Button>
        ) : null}
      </div>

      <PasteSheet
        open={plakOpen}
        library={library}
        onClose={() => setPlakOpen(false)}
        onApply={neemOver}
      />

      {canImportUrl || canImportPhoto ? (
        <WebImportSheet
          open={importOpen}
          library={library}
          onClose={() => setImportOpen(false)}
          onApply={neemOver}
        />
      ) : null}
    </div>
  );
};

export const RecipeFormPage = () => {
  const { id } = useParams();
  const bestaand = useRecipe(id);
  const { loading } = useData();

  if (id && !bestaand) {
    return (
      <div className="py-10 text-center text-ink-2">
        {loading ? 'Bezig met laden…' : 'Dit recept bestaat niet (meer).'}
      </div>
    );
  }
  // De sleutel zorgt dat het formulier opnieuw begint als je naar een ander
  // recept springt.
  return <RecipeForm key={bestaand?.id ?? 'nieuw'} bestaand={bestaand} />;
};
