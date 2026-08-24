import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { linkRecipeLine, mergeIngredients } from '../../domain/ingredients/edits';
import { createLibrary } from '../../domain/ingredients/library';
import {
  analyseLibrary,
  type DuplicatePair,
  type UnlinkedLine,
} from '../../domain/ingredients/maintenance';
import { CATEGORY_LABELS } from '../../domain/schema/enums';
import type { Ingredient } from '../../domain/schema/ingredient';
import { Icon } from '../../ui/Icon';
import { Button, Card, Tag } from '../../ui/controls';
import { IngredientSheet } from './IngredientSheet';
import { ImportSheet } from './ImportSheet';
import { useLibraryEdit } from './useLibraryEdit';

/** Zoekveld dat een ingrediënt kiest, voor het koppelen van losse regels. */
const KoppelKiezer = ({
  library,
  onKies,
  disabled,
}: {
  library: ReturnType<typeof createLibrary>;
  onKies: (id: string) => void;
  disabled: boolean;
}) => {
  const [zoek, setZoek] = useState('');
  const suggesties = useMemo(() => (zoek.trim() ? library.search(zoek, 5) : []), [zoek, library]);

  return (
    <div className="mt-2">
      <input
        type="search"
        value={zoek}
        onChange={(event) => setZoek(event.target.value)}
        placeholder="Koppel aan…"
        className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        aria-label="Zoek een ingrediënt"
      />
      {suggesties.length > 0 ? (
        <ul className="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface">
          {suggesties.map((item) => (
            <li key={item.id} className="border-b border-line last:border-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onKies(item.id);
                  setZoek('');
                }}
                className="flex min-h-11 w-full items-center px-3 text-left text-sm active:bg-surface-2"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const OngekoppeldeRegel = ({
  regel,
  library,
  busy,
  onKoppel,
}: {
  regel: UnlinkedLine;
  library: ReturnType<typeof createLibrary>;
  busy: boolean;
  onKoppel: (ingredientId: string) => void;
}) => (
  <li className="rounded-2xl border border-line bg-surface p-3">
    <p className="font-medium">{regel.name}</p>
    <p className="text-sm text-ink-3">
      <Link to={`/recept/${regel.recipeId}`} className="underline underline-offset-2">
        {regel.recipeTitle}
      </Link>
      , regel {regel.lineIndex + 1}
    </p>
    {regel.suggestion ? (
      <Button
        variant="primary"
        className="mt-2"
        disabled={busy}
        onClick={() => onKoppel(regel.suggestion!.id)}
      >
        <Icon name="vink" className="h-4 w-4" />
        Koppel aan {regel.suggestion.name}
      </Button>
    ) : null}
    <KoppelKiezer library={library} onKies={onKoppel} disabled={busy} />
  </li>
);

const DubbelingRegel = ({
  paar,
  busy,
  onVoegSamen,
}: {
  paar: DuplicatePair;
  busy: boolean;
  onVoegSamen: (fromId: string, intoId: string) => void;
}) => (
  <li className="rounded-2xl border border-line bg-surface p-3">
    <p className="text-sm text-ink-3">{paar.reason}</p>
    <p className="mt-0.5 font-medium">
      {paar.a.name} <span className="text-ink-3">en</span> {paar.b.name}
    </p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button disabled={busy} onClick={() => onVoegSamen(paar.a.id, paar.b.id)}>
        {paar.a.name} → {paar.b.name}
      </Button>
      <Button disabled={busy} onClick={() => onVoegSamen(paar.b.id, paar.a.id)}>
        {paar.b.name} → {paar.a.name}
      </Button>
    </div>
  </li>
);

export const LibraryPage = () => {
  const editor = useLibraryEdit();
  const { state, apply, status, reset } = editor;
  const [tab, setTab] = useState<'alle' | 'opruimen'>('alle');
  const [zoek, setZoek] = useState('');
  const [gekozenId, setGekozenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const rapport = useMemo(() => analyseLibrary(state), [state]);
  const library = useMemo(() => createLibrary(state.ingredients), [state.ingredients]);

  // Alleen het id vasthouden, niet het ingrediënt zelf: na een bewerking wijst
  // dit vanzelf naar de bijgewerkte versie in plaats van naar een kopie van
  // voor de wijziging.
  const gekozen: Ingredient | null =
    (gekozenId ? state.ingredients.find((item) => item.id === gekozenId) : undefined) ?? null;

  const kies = (id: string | null) => {
    reset();
    setGekozenId(id);
  };

  const zichtbaar = useMemo(() => {
    const lijst = zoek.trim() ? library.search(zoek, 50) : library.all;
    return lijst;
  }, [library, zoek]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Bibliotheek</h1>
        <span className="text-sm text-ink-3">{state.ingredients.length} ingrediënten</span>
      </div>

      <p className="text-sm text-ink-2">
        De canonieke ingrediënten waar elk recept naar verwijst. Zonder deze lijst belanden
        &ldquo;ui&rdquo;, &ldquo;uien&rdquo; en &ldquo;Ui&rdquo; als drie regels op je
        boodschappenlijst.
      </p>

      {status.error ? (
        <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">{status.error}</p>
      ) : null}
      {status.success ? (
        <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm text-ok">{status.success}</p>
      ) : null}

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['alle', 'Alle'],
            ['opruimen', `Opruimen${rapport.total > 0 ? ` (${rapport.total})` : ''}`],
          ] as const
        ).map(([waarde, label]) => (
          <button
            key={waarde}
            type="button"
            onClick={() => setTab(waarde)}
            aria-pressed={tab === waarde}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
              tab === waarde ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'alle' ? (
        <>
          <div className="flex gap-2">
            <input
              type="search"
              value={zoek}
              onChange={(event) => setZoek(event.target.value)}
              placeholder="Zoek een ingrediënt"
              className="h-12 flex-1 rounded-xl border border-line bg-surface px-3"
              aria-label="Zoek een ingrediënt"
            />
            <Button onClick={() => setImportOpen(true)}>
              <Icon name="plus" className="h-4 w-4" />
              Import
            </Button>
          </div>

          <ul className="flex flex-col gap-1.5">
            {zichtbaar.map((item) => {
              const gebruik = rapport.usage.get(item.id) ?? 0;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => kies(item.id)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 text-left active:bg-surface-2"
                  >
                    <span className="flex-1">
                      <span className="block font-medium">{item.name}</span>
                      <span className="block text-xs text-ink-3">
                        {CATEGORY_LABELS[item.category]} · {item.defaultUnit}
                        {item.synonyms.length > 0 ? ` · ${item.synonyms.length} synoniemen` : ''}
                      </span>
                    </span>
                    {gebruik === 0 ? (
                      <Tag tone="warn">ongebruikt</Tag>
                    ) : (
                      <span className="text-sm tabular-nums text-ink-3">{gebruik}×</span>
                    )}
                    <Icon name="omlaag" className="h-4 w-4 -rotate-90 text-ink-3" />
                  </button>
                </li>
              );
            })}
          </ul>
          {zichtbaar.length === 0 ? (
            <p className="py-8 text-center text-ink-3">Niets gevonden.</p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {rapport.total === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-medium">Niets op te ruimen.</p>
              <p className="mt-1 text-sm text-ink-2">
                Elke receptregel is gekoppeld en er staan geen dubbelingen in de bibliotheek.
              </p>
            </Card>
          ) : null}

          {rapport.missing.length > 0 ? (
            <section>
              <h2 className="mb-2 font-semibold text-danger">
                Verwijst naar een ingrediënt dat niet bestaat ({rapport.missing.length})
              </h2>
              <p className="mb-2 text-sm text-ink-2">
                Dit is een echte fout: op de boodschappenlijst valt zo&rsquo;n regel weg.
              </p>
              <ul className="flex flex-col gap-2">
                {rapport.missing.map((item) => (
                  <li
                    key={`${item.recipeId}-${item.lineIndex}`}
                    className="rounded-2xl border border-danger/30 bg-surface p-3"
                  >
                    <p className="font-medium">{item.ingredientId}</p>
                    <p className="text-sm text-ink-3">
                      <Link
                        to={`/recept/${item.recipeId}`}
                        className="underline underline-offset-2"
                      >
                        {item.recipeTitle}
                      </Link>
                      , regel {item.lineIndex + 1}
                    </p>
                    <KoppelKiezer
                      library={library}
                      disabled={status.busy}
                      onKies={(id) =>
                        void apply((s) => linkRecipeLine(s, item.recipeId, item.lineIndex, id))
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {rapport.unlinked.length > 0 ? (
            <section>
              <h2 className="mb-2 font-semibold">Nog niet gekoppeld ({rapport.unlinked.length})</h2>
              <p className="mb-2 text-sm text-ink-2">
                Deze regels hebben een losse naam. Ze werken wel, maar tellen niet op met dezelfde
                ingrediënten uit andere recepten.
              </p>
              <ul className="flex flex-col gap-2">
                {rapport.unlinked.map((regel) => (
                  <OngekoppeldeRegel
                    key={`${regel.recipeId}-${regel.lineIndex}`}
                    regel={regel}
                    library={library}
                    busy={status.busy}
                    onKoppel={(id) =>
                      void apply((s) => linkRecipeLine(s, regel.recipeId, regel.lineIndex, id))
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {rapport.duplicates.length > 0 ? (
            <section>
              <h2 className="mb-2 font-semibold">
                Mogelijke dubbelingen ({rapport.duplicates.length})
              </h2>
              <p className="mb-2 text-sm text-ink-2">
                Kies welke naam blijft staan. De ander verdwijnt en blijft als synoniem bestaan.
              </p>
              <ul className="flex flex-col gap-2">
                {rapport.duplicates.map((paar) => (
                  <DubbelingRegel
                    key={`${paar.a.id}-${paar.b.id}`}
                    paar={paar}
                    busy={status.busy}
                    onVoegSamen={(fromId, intoId) =>
                      void apply((s) => mergeIngredients(s, fromId, intoId))
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {rapport.orphans.length > 0 ? (
            <section>
              <h2 className="mb-2 font-semibold">Nergens gebruikt ({rapport.orphans.length})</h2>
              <p className="mb-2 text-sm text-ink-2">
                Geen fout: een startbibliotheek hoort ruimer te zijn dan wat je deze week kookt. Tik
                erop om er een te verwijderen.
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {rapport.orphans.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => kies(item.id)}
                      className="min-h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink-2 active:bg-surface-2"
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <IngredientSheet
        key={gekozenId ?? 'geen'}
        ingredient={gekozen}
        state={state}
        usage={gekozen ? (rapport.usage.get(gekozen.id) ?? 0) : 0}
        onClose={() => kies(null)}
        editor={editor}
      />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} editor={editor} />
    </div>
  );
};
