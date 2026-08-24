import { useMemo, useState } from 'react';
import {
  addSynonyms,
  changeCategory,
  deleteIngredient,
  mergeIngredients,
  renameIngredient,
  setDefaultUnit,
  type LibraryState,
} from '../../domain/ingredients/edits';
import { createLibrary } from '../../domain/ingredients/library';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../domain/schema/enums';
import type { Ingredient } from '../../domain/schema/ingredient';
import { UNITS, type Unit } from '../../domain/units/units';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button, Chip } from '../../ui/controls';
import type { useLibraryEdit } from './useLibraryEdit';

/**
 * Alles wat je aan één ingrediënt kunt veranderen. Elke knop is een aparte
 * commit met een eigen boodschap; dat maakt de geschiedenis leesbaar en het
 * terugdraaien eenvoudig.
 */
export const IngredientSheet = ({
  ingredient,
  state,
  usage,
  onClose,
  editor,
}: {
  ingredient: Ingredient | null;
  state: LibraryState;
  usage: number;
  onClose: () => void;
  editor: ReturnType<typeof useLibraryEdit>;
}) => {
  const { apply, status, canWrite } = editor;
  // Het scherm krijgt een key op het ingrediënt-id mee, dus bij een ander
  // ingrediënt wordt dit paneel opnieuw opgebouwd en beginnen deze velden vanzelf
  // bij de juiste waarden. Dat is betrouwbaarder dan ze in een effect
  // gelijkhouden.
  const [naam, setNaam] = useState(ingredient?.name ?? '');
  const [meervoud, setMeervoud] = useState(ingredient?.plural ?? '');
  const [synoniem, setSynoniem] = useState('');
  const [samenvoegen, setSamenvoegen] = useState(false);
  const [zoek, setZoek] = useState('');
  const [bevestigVerwijderen, setBevestigVerwijderen] = useState(false);

  const bibliotheek = useMemo(() => createLibrary(state.ingredients), [state.ingredients]);
  const kandidaten = useMemo(
    () =>
      ingredient
        ? bibliotheek.search(zoek || ingredient.name, 8).filter((item) => item.id !== ingredient.id)
        : [],
    [bibliotheek, zoek, ingredient],
  );

  if (!ingredient) return null;

  const naamGewijzigd =
    naam.trim() !== ingredient.name || meervoud.trim() !== (ingredient.plural ?? '');

  return (
    <Sheet open onClose={onClose} title={ingredient.name}>
      <div className="flex flex-col gap-6">
        {!canWrite ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
            Je zit in leesmodus. Bewerken kan zodra er een token met schrijfrechten staat.
          </p>
        ) : null}

        {status.error ? (
          <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {status.error}
          </p>
        ) : null}
        {status.success ? (
          <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm text-ok">{status.success}</p>
        ) : null}

        <p className="text-sm text-ink-3">
          Id <code className="rounded bg-surface-2 px-1">{ingredient.id}</code> ·{' '}
          {usage === 0
            ? 'nergens gebruikt'
            : `gebruikt in ${usage} receptregel${usage === 1 ? '' : 's'}`}
        </p>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Naam</h3>
          <input
            value={naam}
            onChange={(event) => setNaam(event.target.value)}
            className="h-12 rounded-xl border border-line bg-surface px-3"
            aria-label="Naam"
          />
          <input
            value={meervoud}
            onChange={(event) => setMeervoud(event.target.value)}
            placeholder="Meervoud (optioneel)"
            className="h-12 rounded-xl border border-line bg-surface px-3"
            aria-label="Meervoud"
          />
          <p className="text-xs text-ink-3">
            Het id verandert niet, want daar verwijzen de recepten naar. De oude naam blijft als
            synoniem staan.
          </p>
          <Button
            variant="primary"
            disabled={!naamGewijzigd || !naam.trim() || status.busy}
            onClick={() => void apply((s) => renameIngredient(s, ingredient.id, naam, meervoud))}
          >
            Naam opslaan
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Synoniemen</h3>
          {ingredient.synonyms.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {ingredient.synonyms.map((item) => (
                <li key={item} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm text-ink-2">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">Nog geen synoniemen.</p>
          )}
          <div className="flex gap-2">
            <input
              value={synoniem}
              onChange={(event) => setSynoniem(event.target.value)}
              placeholder="Nog een schrijfwijze"
              className="h-12 flex-1 rounded-xl border border-line bg-surface px-3"
              aria-label="Synoniem toevoegen"
            />
            <Button
              disabled={!synoniem.trim() || status.busy}
              onClick={() =>
                void apply((s) => addSynonyms(s, ingredient.id, [synoniem])).then((ok) => {
                  if (ok) setSynoniem('');
                })
              }
            >
              <Icon name="plus" className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Schap</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((optie) => (
              <Chip
                key={optie}
                active={ingredient.category === optie}
                disabled={status.busy}
                onClick={() => {
                  if (optie === ingredient.category) return;
                  void apply((s) => changeCategory(s, ingredient.id, optie as Category));
                }}
              >
                {CATEGORY_LABELS[optie]}
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Standaardeenheid</h3>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((optie) => (
              <Chip
                key={optie}
                active={ingredient.defaultUnit === optie}
                disabled={status.busy}
                onClick={() => {
                  if (optie === ingredient.defaultUnit) return;
                  void apply((s) => setDefaultUnit(s, ingredient.id, optie as Unit));
                }}
              >
                {optie}
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Samenvoegen</h3>
          {!samenvoegen ? (
            <Button onClick={() => setSamenvoegen(true)} disabled={!canWrite}>
              Samenvoegen met een ander ingrediënt
            </Button>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">{ingredient.name}</span> verdwijnt en alles
                wat ernaar verwees gaat naar het ingrediënt dat je kiest. De naam blijft als
                synoniem bestaan.
              </p>
              <input
                type="search"
                value={zoek}
                onChange={(event) => setZoek(event.target.value)}
                placeholder="Waarmee samenvoegen?"
                className="h-12 rounded-xl border border-line bg-surface px-3"
                aria-label="Zoek een ingrediënt om mee samen te voegen"
              />
              <ul className="overflow-hidden rounded-xl border border-line bg-surface">
                {kandidaten.map((kandidaat) => (
                  <li key={kandidaat.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      disabled={status.busy}
                      onClick={() =>
                        void apply((s) => mergeIngredients(s, ingredient.id, kandidaat.id)).then(
                          (ok) => {
                            if (ok) onClose();
                          },
                        )
                      }
                      className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left text-sm active:bg-surface-2"
                    >
                      <span>{kandidaat.name}</span>
                      <span className="text-xs text-ink-3">
                        {CATEGORY_LABELS[kandidaat.category]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" onClick={() => setSamenvoegen(false)}>
                Toch niet
              </Button>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-4">
          {usage > 0 ? (
            <p className="text-sm text-ink-3">
              Verwijderen kan niet zolang recepten dit ingrediënt gebruiken. Voeg het samen met een
              ander ingrediënt om ervan af te komen.
            </p>
          ) : !bevestigVerwijderen ? (
            <Button
              variant="danger"
              disabled={!canWrite}
              onClick={() => setBevestigVerwijderen(true)}
            >
              <Icon name="prullenbak" className="h-4 w-4" />
              Verwijderen uit de bibliotheek
            </Button>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                Zeker weten? Het blijft in de git-geschiedenis staan.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" full onClick={() => setBevestigVerwijderen(false)}>
                  Annuleren
                </Button>
                <Button
                  variant="danger"
                  full
                  disabled={status.busy}
                  onClick={() =>
                    void apply((s) => deleteIngredient(s, ingredient.id)).then((ok) => {
                      if (ok) onClose();
                    })
                  }
                >
                  Verwijderen
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </Sheet>
  );
};
