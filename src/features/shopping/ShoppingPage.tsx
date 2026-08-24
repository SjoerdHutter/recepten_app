import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../domain/schema/enums';
import { buildShoppingList, type ShoppingSelection } from '../../domain/shopping/aggregate';
import { shoppingListToText } from '../../domain/shopping/text';
import { formatQuantity } from '../../domain/units/format';
import { useData } from '../../state/data';
import { useLocalState } from '../../state/localState';
import { Icon } from '../../ui/Icon';
import { Button, Card, Stepper, Tag } from '../../ui/controls';

export const ShoppingPage = () => {
  const { dataset, library } = useData();
  const {
    selection,
    manualItems,
    checked,
    toggleChecked,
    clearChecked,
    setServings,
    removeFromSelection,
    clearSelection,
    addManualItem,
    removeManualItem,
  } = useLocalState();

  const [nieuwItem, setNieuwItem] = useState('');
  const [nieuweCategorie, setNieuweCategorie] = useState<Category>('overig');
  const [melding, setMelding] = useState<string | null>(null);

  const selecties = useMemo<ShoppingSelection[]>(
    () =>
      selection
        .map((entry) => {
          const recipe = dataset.recipes.find((r) => r.id === entry.recipeId);
          return recipe ? { recipe, servings: entry.servings } : null;
        })
        .filter((entry): entry is ShoppingSelection => entry !== null),
    [selection, dataset.recipes],
  );

  const groepen = useMemo(
    () => buildShoppingList(selecties, library, manualItems),
    [selecties, library, manualItems],
  );

  const alleRegels = groepen.flatMap((groep) => groep.lines);
  const afgevinkt = alleRegels.filter((regel) => checked[regel.key]).length;

  const kopieer = async () => {
    const tekst = shoppingListToText(groepen, { withSources: true });
    try {
      await navigator.clipboard.writeText(tekst);
      setMelding('Gekopieerd naar het klembord.');
    } catch {
      setMelding('Kopiëren lukte niet. Selecteer de tekst handmatig.');
    }
  };

  const deel = async () => {
    const tekst = shoppingListToText(groepen);
    if (!navigator.share) {
      await kopieer();
      return;
    }
    try {
      await navigator.share({ title: 'Boodschappen', text: tekst });
    } catch {
      /* de gebruiker heeft het deelvenster weggeklikt */
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="print-hidden">
        <h1 className="text-2xl font-semibold">Boodschappen</h1>
        <p className="mt-1 text-sm text-ink-2">
          {alleRegels.length === 0
            ? 'Nog niets op de lijst.'
            : `${afgevinkt} van ${alleRegels.length} afgevinkt`}
        </p>
      </header>

      {selecties.length === 0 && manualItems.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-8 text-center">
          <p className="text-ink-2">Kies eerst een paar recepten.</p>
          <Link to="/" className="mt-3 inline-block text-accent">
            Naar de recepten
          </Link>
        </div>
      ) : null}

      {selecties.length > 0 ? (
        <section className="print-hidden">
          <h2 className="mb-2 text-lg font-semibold">Gekozen recepten</h2>
          <Card className="divide-y divide-line">
            {selecties.map(({ recipe, servings }) => (
              <div key={recipe.id} className="flex items-center gap-3 px-3 py-2.5">
                <Link to={`/recept/${recipe.id}`} className="flex-1 text-[15px] font-medium">
                  {recipe.title}
                </Link>
                <Stepper
                  value={servings}
                  onChange={(waarde) => setServings(recipe.id, waarde)}
                  label={`Personen voor ${recipe.title}`}
                />
                <button
                  type="button"
                  onClick={() => removeFromSelection(recipe.id)}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-3 active:bg-surface-2"
                  aria-label={`${recipe.title} van de lijst halen`}
                >
                  <Icon name="kruis" />
                </button>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {groepen.map((groep) => (
        <section key={groep.category}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-3">
            {groep.label}
          </h2>
          <Card className="divide-y divide-line">
            {[...groep.lines]
              // Afgevinkte regels zakken naar beneden, dan blijft bovenin staan
              // wat je nog moet pakken.
              .sort((a, b) => Number(checked[a.key] ?? false) - Number(checked[b.key] ?? false))
              .map((regel) => {
                const isAf = checked[regel.key] ?? false;
                return (
                  <div key={regel.key} className="flex items-start gap-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleChecked(regel.key)}
                      aria-pressed={isAf}
                      className="flex min-h-14 flex-1 items-start gap-3 py-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          isAf ? 'border-ok bg-ok text-white' : 'border-line'
                        }`}
                      >
                        {isAf ? <Icon name="vink" className="h-4 w-4" /> : null}
                      </span>
                      <span className={isAf ? 'text-ink-3 line-through' : ''}>
                        <span className="font-medium">
                          {regel.quantity ? `${formatQuantity(regel.quantity)} ` : ''}
                          {regel.label}
                        </span>
                        {regel.optional ? <Tag>optioneel</Tag> : null}
                        {regel.sources.length > 0 ? (
                          <span className="mt-0.5 block text-xs text-ink-3">
                            {regel.sources
                              .map((bron) => `${bron.title} (${formatQuantity(bron.quantity)})`)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {regel.manual ? (
                      <button
                        type="button"
                        onClick={() => removeManualItem(regel.key.replace('los:', ''))}
                        className="flex h-14 w-11 items-center justify-center text-ink-3 print-hidden"
                        aria-label={`${regel.label} verwijderen`}
                      >
                        <Icon name="kruis" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
          </Card>
        </section>
      ))}

      <section className="print-hidden">
        <h2 className="mb-2 text-lg font-semibold">Los toevoegen</h2>
        <div className="flex gap-2">
          <input
            value={nieuwItem}
            onChange={(event) => setNieuwItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              addManualItem(nieuwItem, nieuweCategorie);
              setNieuwItem('');
            }}
            placeholder="Bijvoorbeeld wc-papier"
            className="h-12 flex-1 rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-ink-3"
            aria-label="Los item"
          />
          <select
            value={nieuweCategorie}
            onChange={(event) => setNieuweCategorie(event.target.value as Category)}
            className="h-12 rounded-xl border border-line bg-surface px-2 text-ink"
            aria-label="Categorie"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={() => {
              addManualItem(nieuwItem, nieuweCategorie);
              setNieuwItem('');
            }}
            aria-label="Toevoegen"
          >
            <Icon name="plus" className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {alleRegels.length > 0 ? (
        <section className="flex flex-wrap gap-2 print-hidden">
          <Button variant="secondary" onClick={deel}>
            <Icon name="delen" className="h-4 w-4" />
            Delen
          </Button>
          <Button variant="secondary" onClick={kopieer}>
            <Icon name="kopieer" className="h-4 w-4" />
            Kopiëren
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Icon name="printer" className="h-4 w-4" />
            Printen
          </Button>
          {afgevinkt > 0 ? (
            <Button variant="ghost" onClick={clearChecked}>
              Vinkjes wissen
            </Button>
          ) : null}
          {selecties.length > 0 ? (
            <Button variant="ghost" onClick={clearSelection}>
              Recepten leegmaken
            </Button>
          ) : null}
        </section>
      ) : null}

      {melding ? (
        <p className="text-sm text-ink-2 print-hidden" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
};
