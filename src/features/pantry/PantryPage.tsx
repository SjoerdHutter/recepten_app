import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { rankByPantry, type Cookability } from '../../domain/pantry/cook';
import { findExpiring, formatDays, type PantryItem } from '../../domain/pantry/pantry';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../domain/schema/enums';
import type { Ingredient } from '../../domain/schema/ingredient';
import { formatQuantity } from '../../domain/units/format';
import { useData } from '../../state/data';
import { useLocalState } from '../../state/localState';
import { Icon } from '../../ui/Icon';
import { Button, Card, Tag } from '../../ui/controls';
import { LeftoverSheet } from './LeftoverSheet';
import { PantryItemSheet } from './PantryItemSheet';

/** Zoekveld dat een ingrediënt aan de voorraadkast toevoegt. */
const Toevoegen = () => {
  const { library } = useData();
  const { addToPantry, hasInPantry } = useLocalState();
  const [zoek, setZoek] = useState('');

  const suggesties = useMemo(
    () => (zoek.trim() ? library.search(zoek, 6).filter((item) => !hasInPantry(item.id)) : []),
    [zoek, library, hasInPantry],
  );

  return (
    <div>
      <input
        type="search"
        value={zoek}
        onChange={(event) => setZoek(event.target.value)}
        placeholder="Wat heb je in huis?"
        className="h-12 w-full rounded-xl border border-line bg-surface px-3"
        aria-label="Ingrediënt toevoegen aan de voorraadkast"
        autoComplete="off"
      />
      {suggesties.length > 0 ? (
        <ul className="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface">
          {suggesties.map((ingredient) => (
            <li key={ingredient.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => {
                  addToPantry(ingredient.id);
                  setZoek('');
                }}
                className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm active:bg-surface-2"
              >
                <Icon name="plus" className="h-4 w-4 text-accent" />
                <span className="flex-1">{ingredient.name}</span>
                <span className="text-xs text-ink-3">{CATEGORY_LABELS[ingredient.category]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const VoorraadRegel = ({
  item,
  ingredient,
  onOpen,
  dagen,
}: {
  item: PantryItem;
  ingredient: Ingredient | undefined;
  onOpen: () => void;
  dagen: number | undefined;
}) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-13 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left active:bg-surface-2"
    >
      <span className="flex-1">
        <span className="block font-medium">{ingredient?.name ?? item.ingredientId}</span>
        {item.amount !== undefined && item.unit ? (
          <span className="block text-xs text-ink-3">
            {formatQuantity({ amount: item.amount, unit: item.unit })}
          </span>
        ) : null}
      </span>
      {dagen !== undefined ? (
        <Tag tone={dagen <= 1 ? 'warn' : 'neutral'}>{formatDays(dagen)}</Tag>
      ) : null}
      <Icon name="omlaag" className="h-4 w-4 -rotate-90 text-ink-3" />
    </button>
  </li>
);

const KookbaarRegel = ({ uitkomst }: { uitkomst: Cookability }) => {
  const compleet = uitkomst.missing.length === 0;
  return (
    <li>
      <Link
        to={`/recept/${uitkomst.recipe.id}`}
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 active:bg-surface-2"
      >
        <span className="flex-1">
          <span className="block font-medium">{uitkomst.recipe.title}</span>
          <span className="block text-xs text-ink-3">
            {compleet
              ? `alle ${uitkomst.requiredCount} ingrediënten in huis`
              : `je mist ${uitkomst.missing.map((m) => m.label).join(', ')}`}
            {uitkomst.toTaste > 0 ? ` · ${uitkomst.toTaste}× op smaak` : ''}
          </span>
        </span>
        {compleet ? <Tag tone="ok">compleet</Tag> : <Tag>{uitkomst.missing.length}</Tag>}
      </Link>
    </li>
  );
};

export const PantryPage = () => {
  const { dataset, library } = useData();
  const { pantry, removeFromPantry } = useLocalState();
  const [tab, setTab] = useState<'kast' | 'maken'>('kast');
  const [geopendId, setGeopendId] = useState<string | null>(null);
  const [restjesId, setRestjesId] = useState<string | null>(null);

  const bijnaOver = useMemo(() => findExpiring(pantry, new Date()), [pantry]);
  const houdbaarheid = useMemo(
    () => new Map(bijnaOver.map((entry) => [entry.item.ingredientId, entry.days])),
    [bijnaOver],
  );

  const perCategorie = useMemo(() => {
    const groepen = new Map<Category, PantryItem[]>();
    for (const item of pantry) {
      const categorie = library.get(item.ingredientId)?.category ?? 'overig';
      groepen.set(categorie, [...(groepen.get(categorie) ?? []), item]);
    }
    return CATEGORIES.map((categorie) => ({
      categorie,
      items: (groepen.get(categorie) ?? []).sort((a, b) =>
        (library.get(a.ingredientId)?.name ?? a.ingredientId).localeCompare(
          library.get(b.ingredientId)?.name ?? b.ingredientId,
          'nl',
        ),
      ),
    })).filter((groep) => groep.items.length > 0);
  }, [pantry, library]);

  const ranglijst = useMemo(
    () => (tab === 'maken' ? rankByPantry(dataset.recipes, pantry, library) : []),
    [tab, dataset.recipes, pantry, library],
  );

  const geopend = pantry.find((item) => item.ingredientId === geopendId) ?? null;
  const compleet = ranglijst.filter((item) => item.missing.length === 0);
  const bijna = ranglijst.filter((item) => item.missing.length > 0 && item.missing.length <= 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Voorraadkast</h1>
        <span className="text-sm text-ink-3">
          {pantry.length === 0
            ? 'nog leeg'
            : `${pantry.length} ${pantry.length === 1 ? 'ding' : 'dingen'}`}
        </span>
      </div>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['kast', 'In huis'],
            ['maken', 'Wat kan ik maken'],
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

      {tab === 'kast' ? (
        <>
          {bijnaOver.length > 0 ? (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-warn">
                <Icon name="waarschuwing" className="h-4 w-4" />
                Bijna over ({bijnaOver.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {bijnaOver.map((entry) => {
                  const ingredient = library.get(entry.item.ingredientId);
                  return (
                    <li
                      key={entry.item.ingredientId}
                      className="rounded-2xl border border-warn/30 bg-warn-soft/40 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-medium">
                          {ingredient?.name ?? entry.item.ingredientId}
                        </span>
                        <span className="text-sm text-warn">{formatDays(entry.days)}</span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button onClick={() => setRestjesId(entry.item.ingredientId)}>
                          <Icon name="boek" className="h-4 w-4" />
                          Wat kan ik ermee?
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => removeFromPantry(entry.item.ingredientId)}
                        >
                          Op
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <Toevoegen />

          {pantry.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-medium">Je voorraadkast is nog leeg.</p>
              <p className="mt-1 text-sm text-ink-2">
                Vink aan wat je in huis hebt. Dat wordt afgetrokken van je boodschappenlijst, en je
                ziet meteen welke gerechten je nu al kunt maken.
              </p>
            </Card>
          ) : (
            perCategorie.map((groep) => (
              <section key={groep.categorie}>
                <h2 className="mb-2 text-sm font-semibold text-ink-2">
                  {CATEGORY_LABELS[groep.categorie]}
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {groep.items.map((item) => (
                    <VoorraadRegel
                      key={item.ingredientId}
                      item={item}
                      ingredient={library.get(item.ingredientId)}
                      dagen={houdbaarheid.get(item.ingredientId)}
                      onOpen={() => setGeopendId(item.ingredientId)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      ) : (
        <>
          {pantry.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-medium">Vul eerst je voorraadkast.</p>
              <p className="mt-1 text-sm text-ink-2">
                Zonder te weten wat je in huis hebt kan de app niet zeggen wat je kunt maken.
              </p>
            </Card>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                Optionele ingrediënten en dingen die je naar smaak toevoegt tellen niet mee als
                missend, anders zou elk gerecht eeuwig melden dat je zout mist.
              </p>

              {compleet.length > 0 ? (
                <section>
                  <h2 className="mb-2 font-semibold text-ok">Alles in huis ({compleet.length})</h2>
                  <ul className="flex flex-col gap-1.5">
                    {compleet.map((item) => (
                      <KookbaarRegel key={item.recipe.id} uitkomst={item} />
                    ))}
                  </ul>
                </section>
              ) : null}

              {bijna.length > 0 ? (
                <section>
                  <h2 className="mb-2 font-semibold">Bijna ({bijna.length})</h2>
                  <ul className="flex flex-col gap-1.5">
                    {bijna.map((item) => (
                      <KookbaarRegel key={item.recipe.id} uitkomst={item} />
                    ))}
                  </ul>
                </section>
              ) : null}

              {compleet.length === 0 && bijna.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="font-medium">Nog niets binnen handbereik.</p>
                  <p className="mt-1 text-sm text-ink-2">
                    Voor elk recept mis je meer dan drie ingrediënten. Vink meer aan in je
                    voorraadkast, of ga boodschappen doen.
                  </p>
                </Card>
              ) : null}
            </>
          )}
        </>
      )}

      <PantryItemSheet
        key={geopendId ?? 'geen'}
        item={geopend}
        ingredient={library.get(geopendId ?? undefined)}
        onClose={() => setGeopendId(null)}
        onShowRecipes={() => {
          setRestjesId(geopendId);
          setGeopendId(null);
        }}
      />
      <LeftoverSheet
        ingredient={restjesId ? (library.get(restjesId) ?? null) : null}
        onClose={() => setRestjesId(null)}
      />
    </div>
  );
};
