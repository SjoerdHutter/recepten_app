import { useMemo } from 'react';
import { ALLERGENS, ALLERGEN_LABELS, DIFFICULTIES, METHODS } from '../../domain/schema/enums';
import type { Allergen, Difficulty, Method } from '../../domain/schema/enums';
import type { FilterState } from '../../domain/filters/filter';
import { EMPTY_FILTERS } from '../../domain/filters/filter';
import type { IngredientLibrary } from '../../domain/ingredients/library';
import type { Recipe } from '../../domain/schema/recipe';
import { Sheet } from '../../ui/Sheet';
import { Button, Chip } from '../../ui/controls';
import { IngredientPicker } from './IngredientPicker';

const TOTALE_TIJDEN = [20, 30, 45, 60, 90];
const WERKTIJDEN = [10, 15, 20, 30, 45];

const Sectie = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
    <h3 className="mb-2.5 text-sm font-semibold">{title}</h3>
    {children}
  </section>
);

const wissel = <T,>(lijst: T[], waarde: T): T[] =>
  lijst.includes(waarde) ? lijst.filter((entry) => entry !== waarde) : [...lijst, waarde];

export const FilterSheet = ({
  open,
  onClose,
  filters,
  onChange,
  library,
  recipes,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  library: IngredientLibrary;
  recipes: Recipe[];
  resultCount: number;
}) => {
  const tags = useMemo(
    () =>
      [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) =>
        a.localeCompare(b, 'nl'),
      ),
    [recipes],
  );

  const patch = (deel: Partial<FilterState>) => onChange({ ...filters, ...deel });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-2 pb-1">
          <Button
            variant="ghost"
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
          >
            Wissen
          </Button>
          <Button variant="primary" full onClick={onClose}>
            {resultCount} {resultCount === 1 ? 'recept' : 'recepten'} tonen
          </Button>
        </div>
      }
    >
      <Sectie title="Totale tijd">
        <div className="flex flex-wrap gap-2">
          {TOTALE_TIJDEN.map((minuten) => (
            <Chip
              key={minuten}
              active={filters.maxTotal === minuten}
              onClick={() => patch({ maxTotal: filters.maxTotal === minuten ? null : minuten })}
            >
              tot {minuten} min
            </Chip>
          ))}
        </div>
      </Sectie>

      <Sectie title="Waarvan werk">
        <div className="flex flex-wrap gap-2">
          {WERKTIJDEN.map((minuten) => (
            <Chip
              key={minuten}
              active={filters.maxActive === minuten}
              onClick={() => patch({ maxActive: filters.maxActive === minuten ? null : minuten })}
            >
              tot {minuten} min
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Een stoofpot van drie uur waarvan twintig minuten werk is, valt hier gewoon onder.
        </p>
      </Sectie>

      <Sectie title="Bereidingswijze">
        <div className="flex flex-wrap gap-2">
          {METHODS.map((method) => (
            <Chip
              key={method}
              active={filters.methods.includes(method)}
              onClick={() => patch({ methods: wissel<Method>(filters.methods, method) })}
            >
              {method}
            </Chip>
          ))}
        </div>
      </Sectie>

      <Sectie title="Moeilijkheid">
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((difficulty) => (
            <Chip
              key={difficulty}
              active={filters.difficulties.includes(difficulty)}
              onClick={() =>
                patch({ difficulties: wissel<Difficulty>(filters.difficulties, difficulty) })
              }
            >
              {difficulty}
            </Chip>
          ))}
        </div>
      </Sectie>

      <Sectie title="Ingrediënten">
        <div className="flex flex-col gap-4">
          <IngredientPicker
            label="Moet erin zitten"
            library={library}
            selected={filters.includeIngredients}
            onChange={(ids) => patch({ includeIngredients: ids })}
          />
          <IngredientPicker
            label="Mag er niet in zitten"
            library={library}
            selected={filters.excludeIngredients}
            onChange={(ids) => patch({ excludeIngredients: ids })}
          />
        </div>
      </Sectie>

      {tags.length > 0 ? (
        <Sectie title="Dieet en soort">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Chip
                key={tag}
                active={filters.tags.includes(tag)}
                onClick={() => patch({ tags: wissel(filters.tags, tag) })}
              >
                {tag}
              </Chip>
            ))}
          </div>
        </Sectie>
      ) : null}

      <Sectie title="Allergenen uitsluiten">
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => (
            <Chip
              key={allergen}
              active={filters.excludeAllergens.includes(allergen)}
              onClick={() =>
                patch({ excludeAllergens: wissel<Allergen>(filters.excludeAllergens, allergen) })
              }
            >
              {ALLERGEN_LABELS[allergen]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Dit is een harde uitsluiting: recepten met dit allergeen verdwijnen volledig uit de lijst.
        </p>
      </Sectie>

      <Sectie title="Seizoen">
        <Chip
          active={filters.seasonOnly}
          onClick={() => patch({ seasonOnly: !filters.seasonOnly })}
        >
          Nu in seizoen
        </Chip>
      </Sectie>
    </Sheet>
  );
};
