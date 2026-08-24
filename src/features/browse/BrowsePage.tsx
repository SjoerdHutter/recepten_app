import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { countActiveFilters, filterRecipes, hasActiveFilters } from '../../domain/filters/filter';
import type { FilterState } from '../../domain/filters/filter';
import { filtersFromParams, filtersToParams } from '../../domain/filters/url';
import type { Recipe } from '../../domain/schema/recipe';
import { useData } from '../../state/data';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { FilterSheet } from './FilterSheet';
import { RecipeCard } from './RecipeCard';

export const BrowsePage = () => {
  const { dataset, library, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [verrassing, setVerrassing] = useState<Recipe | null>(null);
  const [gezien, setGezien] = useState<string[]>([]);

  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const maand = useMemo(() => new Date().getMonth() + 1, []);

  const setFilters = useCallback(
    (next: FilterState) => setSearchParams(filtersToParams(next), { replace: true }),
    [setSearchParams],
  );

  const resultaten = useMemo(
    () => filterRecipes(dataset.recipes, filters, { library, month: maand }),
    [dataset.recipes, filters, library, maand],
  );

  const actieveFilters = countActiveFilters(filters);

  const kiesVerrassing = useCallback(
    (huidigGezien: string[]) => {
      const kandidaten = resultaten.filter((recipe) => !huidigGezien.includes(recipe.id));
      // Alles al langsgekomen? Dan begint de ronde opnieuw.
      const pool = kandidaten.length > 0 ? kandidaten : resultaten;
      if (pool.length === 0) return;
      const keuze = pool[Math.floor(Math.random() * pool.length)];
      if (!keuze) return;
      setVerrassing(keuze);
      setGezien(kandidaten.length > 0 ? [...huidigGezien, keuze.id] : [keuze.id]);
    },
    [resultaten],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon
            name="zoek"
            filled
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
          />
          <input
            type="search"
            inputMode="search"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Zoek op naam of ingrediënt"
            aria-label="Zoeken"
            className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-ink placeholder:text-ink-3"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink active:bg-surface-2"
          aria-label="Filters openen"
        >
          <Icon name="filter" />
          {actieveFilters > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accent px-1.5 text-[11px] leading-5 text-on-accent">
              {actieveFilters}
            </span>
          ) : null}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite">
          {loading
            ? 'Bezig met laden…'
            : `${resultaten.length} van ${dataset.recipes.length} ${dataset.recipes.length === 1 ? 'recept' : 'recepten'}`}
        </p>
        <Button
          variant="secondary"
          onClick={() => kiesVerrassing(gezien)}
          disabled={resultaten.length === 0}
        >
          <Icon name="dobbelsteen" className="h-4 w-4" />
          Verras me
        </Button>
      </div>

      {dataset.problems.length > 0 ? (
        <Link
          to="/instellingen"
          className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn"
        >
          {dataset.problems.length}{' '}
          {dataset.problems.length === 1
            ? 'bestand kon ik niet lezen'
            : 'bestanden kon ik niet lezen'}
          . Bekijk de details in de instellingen.
        </Link>
      ) : null}

      {resultaten.length === 0 && !loading ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-8 text-center">
          <p className="text-ink-2">Geen recept dat hieraan voldoet.</p>
          {hasActiveFilters(filters) ? (
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => setFilters(filtersFromParams(new URLSearchParams()))}
            >
              Filters wissen
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {resultaten.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </ul>
      )}

      <Link
        to="/toevoegen"
        aria-label="Recept toevoegen"
        className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg print-hidden"
      >
        <Icon name="plus" className="h-7 w-7" />
      </Link>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        library={library}
        recipes={dataset.recipes}
        resultCount={resultaten.length}
      />

      <Sheet
        open={verrassing !== null}
        onClose={() => setVerrassing(null)}
        title="Zullen we dit maken?"
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" full onClick={() => kiesVerrassing(gezien)}>
              Nee, volgende
            </Button>
            <Button variant="primary" full onClick={() => setVerrassing(null)}>
              Sluiten
            </Button>
          </div>
        }
      >
        {verrassing ? (
          <ul>
            <RecipeCard recipe={verrassing} />
          </ul>
        ) : null}
      </Sheet>
    </div>
  );
};
