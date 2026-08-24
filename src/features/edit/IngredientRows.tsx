import { useState } from 'react';
import type { IngredientLibrary } from '../../domain/ingredients/library';
import type { Ingredient } from '../../domain/schema/ingredient';
import type { Scaling } from '../../domain/schema/recipe';
import { UNITS, type Unit } from '../../domain/units/units';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/controls';
import { legeIngredient, type DraftIngredient } from './draft';
import { NewIngredientSheet } from './NewIngredientSheet';

/** De eenheden die je bijna altijd nodig hebt staan vooraan. */
const VEELGEBRUIKT: Unit[] = ['g', 'ml', 'el', 'tl', 'stuks'];

const SCHAAL_LABELS: Record<Scaling, string> = {
  linear: 'schaalt mee',
  taste: 'naar smaak',
  fixed: 'schaalt niet',
};

const UnitKnop = ({
  unit,
  actief,
  onClick,
}: {
  unit: Unit;
  actief: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={actief}
    className={`h-11 min-w-11 rounded-lg px-2.5 text-sm font-medium ${
      actief ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2'
    }`}
  >
    {unit}
  </button>
);

const Regel = ({
  regel,
  library,
  onChange,
  onRemove,
  onCreateIngredient,
  autoFocus,
}: {
  regel: DraftIngredient;
  library: IngredientLibrary;
  onChange: (regel: DraftIngredient) => void;
  onRemove: () => void;
  onCreateIngredient: (ingredient: Ingredient) => void;
  autoFocus: boolean;
}) => {
  const [suggesties, setSuggesties] = useState<Ingredient[]>([]);
  const [meer, setMeer] = useState(false);
  // Staat er al een eenheid die niet bij de snelknoppen zit, dan moet je hem
  // wel kunnen zien staan.
  const [alleEenheden, setAlleEenheden] = useState(
    regel.unit !== '' && !VEELGEBRUIKT.includes(regel.unit),
  );
  const [nieuwOpen, setNieuwOpen] = useState(false);

  const onbekend = regel.name.trim().length > 1 && !regel.ingredientId;

  const kiesNaam = (waarde: string) => {
    onChange({ ...regel, name: waarde, ingredientId: undefined });
    setSuggesties(waarde.trim() ? library.search(waarde, 5) : []);
  };

  const kies = (ingredient: Ingredient) => {
    onChange({
      ...regel,
      name: ingredient.name,
      ingredientId: ingredient.id,
      unit: regel.unit || ingredient.defaultUnit,
    });
    setSuggesties([]);
  };

  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <input
            value={regel.name}
            onChange={(event) => kiesNaam(event.target.value)}
            onBlur={() => window.setTimeout(() => setSuggesties([]), 150)}
            placeholder="Ingrediënt"
            autoFocus={autoFocus}
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-line bg-bg px-3"
            aria-label="Ingrediënt"
          />
          {suggesties.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              {suggesties.map((ingredient) => (
                <li key={ingredient.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => kies(ingredient)}
                    className="flex min-h-11 w-full items-center px-3 text-left text-sm active:bg-surface-2"
                  >
                    {ingredient.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-12 w-10 items-center justify-center rounded-lg text-ink-3 active:bg-surface-2"
          aria-label="Regel verwijderen"
        >
          <Icon name="kruis" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={regel.amount}
          onChange={(event) => onChange({ ...regel, amount: event.target.value })}
          // Het numerieke toetsenbord, maar wel met een komma erop.
          inputMode="decimal"
          placeholder="Aantal"
          className="h-11 w-24 rounded-xl border border-line bg-bg px-3 tabular-nums"
          aria-label="Hoeveelheid"
        />
        <div className="flex flex-wrap gap-1.5">
          {(alleEenheden ? UNITS : VEELGEBRUIKT).map((unit) => (
            <UnitKnop
              key={unit}
              unit={unit}
              actief={regel.unit === unit}
              onClick={() => onChange({ ...regel, unit: regel.unit === unit ? '' : unit })}
            />
          ))}
          {!alleEenheden ? (
            <button
              type="button"
              onClick={() => setAlleEenheden(true)}
              className="h-11 rounded-lg px-2.5 text-sm text-ink-3"
            >
              meer…
            </button>
          ) : null}
        </div>
      </div>

      {onbekend ? (
        <button
          type="button"
          onClick={() => setNieuwOpen(true)}
          className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl bg-warn-soft px-3 text-left text-sm text-warn"
        >
          <Icon name="plus" className="h-4 w-4" />
          &ldquo;{regel.name}&rdquo; staat nog niet in de bibliotheek. Toevoegen?
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setMeer(!meer)}
        className="mt-2 flex min-h-9 items-center gap-1 text-sm text-ink-3"
      >
        <Icon name="omlaag" className={`h-4 w-4 ${meer ? 'rotate-180' : ''}`} />
        {meer ? 'Minder' : 'Toelichting en schaling'}
      </button>

      {meer ? (
        <div className="mt-1 flex flex-col gap-2">
          <input
            value={regel.note}
            onChange={(event) => onChange({ ...regel, note: event.target.value })}
            placeholder="fijngesneden, op kamertemperatuur"
            className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
            aria-label="Toelichting"
          />
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SCHAAL_LABELS) as Scaling[]).map((optie) => (
              <button
                key={optie}
                type="button"
                onClick={() => onChange({ ...regel, scales: optie })}
                aria-pressed={regel.scales === optie}
                className={`h-10 rounded-lg px-3 text-sm ${
                  regel.scales === optie ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2'
                }`}
              >
                {SCHAAL_LABELS[optie]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...regel, optional: !regel.optional })}
              aria-pressed={regel.optional}
              className={`h-10 rounded-lg px-3 text-sm ${
                regel.optional ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-2'
              }`}
            >
              optioneel
            </button>
          </div>
        </div>
      ) : null}

      <NewIngredientSheet
        open={nieuwOpen}
        naam={regel.name.trim()}
        onClose={() => setNieuwOpen(false)}
        onCreate={(ingredient) => {
          onCreateIngredient(ingredient);
          onChange({
            ...regel,
            name: ingredient.name,
            ingredientId: ingredient.id,
            unit: regel.unit || ingredient.defaultUnit,
          });
        }}
      />
    </li>
  );
};

export const IngredientRows = ({
  regels,
  library,
  onChange,
  onCreateIngredient,
}: {
  regels: DraftIngredient[];
  library: IngredientLibrary;
  onChange: (regels: DraftIngredient[]) => void;
  onCreateIngredient: (ingredient: Ingredient) => void;
}) => {
  const [laatstToegevoegd, setLaatstToegevoegd] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {regels.map((regel, index) => (
          <Regel
            key={regel.key}
            regel={regel}
            library={library}
            autoFocus={regel.key === laatstToegevoegd}
            onChange={(nieuw) =>
              onChange(regels.map((bestaand, i) => (i === index ? nieuw : bestaand)))
            }
            onRemove={() =>
              onChange(
                regels.length > 1 ? regels.filter((_, i) => i !== index) : [legeIngredient()],
              )
            }
            onCreateIngredient={onCreateIngredient}
          />
        ))}
      </ul>
      <Button
        variant="secondary"
        full
        onClick={() => {
          const nieuw = legeIngredient();
          setLaatstToegevoegd(nieuw.key);
          onChange([...regels, nieuw]);
        }}
      >
        <Icon name="plus" className="h-4 w-4" />
        Nog een ingrediënt
      </Button>
    </div>
  );
};
