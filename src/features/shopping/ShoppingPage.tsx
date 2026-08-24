import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  applyPantry,
  effectiveQuantity,
  stillToBuy,
  withoutCovered,
} from '../../domain/pantry/subtract';
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
    pantry,
    subtractPantry,
    setSubtractPantry,
    addToPantry,
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

  const groepen = useMemo(() => {
    const basis = buildShoppingList(selecties, library, manualItems);
    return subtractPantry ? applyPantry(basis, pantry, library) : basis;
  }, [selecties, library, manualItems, subtractPantry, pantry]);

  const alleRegels = groepen.flatMap((groep) => groep.lines);
  const teHalen = stillToBuy(groepen);
  const gedekt = alleRegels.length - teHalen.length;
  const afgevinkt = teHalen.filter((regel) => checked[regel.key]).length;

  // Wat je al in huis hebt hoort niet in de tekst die je deelt of meeneemt.
  const meeneemlijst = subtractPantry ? withoutCovered(groepen) : groepen;

  /** Na het boodschappen doen: wat je afvinkte staat nu in je kast. */
  const naarVoorraad = () => {
    const regels = teHalen.filter(
      (regel) => checked[regel.key] && regel.ingredientId && !regel.manual,
    );
    for (const regel of regels) {
      const rest = effectiveQuantity(regel);
      addToPantry(
        regel.ingredientId as string,
        rest ? { amount: rest.amount, unit: rest.unit } : {},
      );
    }
    clearChecked();
    setMelding(
      regels.length === 1
        ? '1 item naar de voorraadkast verplaatst.'
        : `${regels.length} items naar de voorraadkast verplaatst.`,
    );
  };

  const kopieer = async () => {
    const tekst = shoppingListToText(meeneemlijst, { withSources: true });
    try {
      await navigator.clipboard.writeText(tekst);
      setMelding('Gekopieerd naar het klembord.');
    } catch {
      setMelding('Kopiëren lukte niet. Selecteer de tekst handmatig.');
    }
  };

  const deel = async () => {
    const tekst = shoppingListToText(meeneemlijst);
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
            : `${afgevinkt} van ${teHalen.length} afgevinkt`}
          {gedekt > 0 ? ` · ${gedekt} heb je al` : ''}
        </p>
      </header>

      {pantry.length > 0 ? (
        <button
          type="button"
          onClick={() => setSubtractPantry(!subtractPantry)}
          aria-pressed={subtractPantry}
          className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-3 text-left print-hidden"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
              subtractPantry ? 'border-accent bg-accent text-on-accent' : 'border-line'
            }`}
          >
            {subtractPantry ? <Icon name="vink" className="h-4 w-4" /> : null}
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-medium">Voorraadkast aftrekken</span>
            <span className="block text-xs text-ink-3">
              {subtractPantry
                ? 'Wat je in huis hebt staat doorgestreept en gaat niet mee in het delen.'
                : 'De lijst toont alles, ook wat al in je kast staat.'}
            </span>
          </span>
        </button>
      ) : null}

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
              // Afgevinkte regels en wat je al in huis hebt zakken naar beneden,
              // dan blijft bovenin staan wat je nog moet pakken.
              .sort(
                (a, b) =>
                  Number((checked[a.key] ?? false) || a.stock?.coverage === 'volledig') -
                  Number((checked[b.key] ?? false) || b.stock?.coverage === 'volledig'),
              )
              .map((regel) => {
                const stock = regel.stock;
                const inHuis = stock?.coverage === 'volledig';
                const isAf = (checked[regel.key] ?? false) || inHuis;
                const hoeveelheid = effectiveQuantity(regel);
                // Nooit stilletjes wegstrepen: als de app iets aftrekt moet je
                // in de winkel kunnen zien waaróm.
                const voorraadTag =
                  stock?.coverage === 'deels' && stock.have
                    ? `${formatQuantity(stock.have)} in huis`
                    : stock?.coverage === 'onbekend' && stock.have
                      ? `je hebt ${formatQuantity(stock.have)}, niet om te rekenen`
                      : null;
                return (
                  <div key={regel.key} className="flex items-start gap-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleChecked(regel.key)}
                      aria-pressed={isAf}
                      disabled={inHuis}
                      className="flex min-h-14 flex-1 items-start gap-3 py-3 text-left disabled:cursor-default"
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
                          {hoeveelheid ? `${formatQuantity(hoeveelheid)} ` : ''}
                          {regel.label}
                        </span>
                        {regel.optional ? <Tag>optioneel</Tag> : null}
                        {inHuis ? <Tag tone="ok">in huis</Tag> : null}
                        {voorraadTag ? (
                          <Tag tone={stock?.coverage === 'onbekend' ? 'warn' : 'ok'}>
                            {voorraadTag}
                          </Tag>
                        ) : null}
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
            <Button variant="primary" onClick={naarVoorraad}>
              <Icon name="kast" className="h-4 w-4" />
              {afgevinkt} naar voorraad
            </Button>
          ) : null}
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
