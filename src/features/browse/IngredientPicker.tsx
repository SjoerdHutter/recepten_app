import { useMemo, useState } from 'react';
import type { IngredientLibrary } from '../../domain/ingredients/library';
import { Icon } from '../../ui/Icon';

/** Ingrediënten kiezen met suggesties, zodat je nooit een naam hoeft te raden. */
export const IngredientPicker = ({
  label,
  library,
  selected,
  onChange,
}: {
  label: string;
  library: IngredientLibrary;
  selected: string[];
  onChange: (ids: string[]) => void;
}) => {
  const [query, setQuery] = useState('');
  const suggesties = useMemo(
    () => (query.trim() ? library.search(query, 6).filter((i) => !selected.includes(i.id)) : []),
    [query, library, selected],
  );

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-2">{label}</label>
      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((entry) => entry !== id))}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-sm text-accent"
              >
                {library.label(id, id)}
                <Icon name="kruis" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Typ een ingrediënt"
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-ink-3"
        autoComplete="off"
      />
      {suggesties.length > 0 ? (
        <ul className="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface">
          {suggesties.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...selected, ingredient.id]);
                  setQuery('');
                }}
                className="flex min-h-11 w-full items-center px-3 text-left text-sm active:bg-surface-2"
              >
                {ingredient.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
