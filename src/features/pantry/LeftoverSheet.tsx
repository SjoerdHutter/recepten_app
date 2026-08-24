import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HOOFDROL_DREMPEL, rankByIngredient } from '../../domain/pantry/leftovers';
import type { Ingredient } from '../../domain/schema/ingredient';
import { formatQuantity } from '../../domain/units/format';
import { useData } from '../../state/data';
import { Sheet } from '../../ui/Sheet';
import { Chip } from '../../ui/controls';

/**
 * Restjesmodus. Elk recept dat kool bevat is geen antwoord op "die halve kool
 * moet op": in een currysaus gaat twee eetlepel kool en die ligt morgen nog in
 * de koelkast. Daarom staat het aandeel erbij, en staan hoofdrollen vooraan.
 */
export const LeftoverSheet = ({
  ingredient,
  onClose,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
}) => {
  const { dataset, library } = useData();
  const [alleenHoofdrol, setAlleenHoofdrol] = useState(true);

  const treffers = useMemo(
    () => (ingredient ? rankByIngredient(dataset.recipes, ingredient.id, library) : []),
    [dataset.recipes, ingredient, library],
  );

  if (!ingredient) return null;

  const zichtbaar = alleenHoofdrol
    ? treffers.filter((match) => match.share >= HOOFDROL_DREMPEL)
    : treffers;

  return (
    <Sheet open onClose={onClose} title={`Recepten met ${ingredient.name}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Chip active={alleenHoofdrol} onClick={() => setAlleenHoofdrol(true)}>
            Hoofdrol
          </Chip>
          <Chip active={!alleenHoofdrol} onClick={() => setAlleenHoofdrol(false)}>
            Alles ({treffers.length})
          </Chip>
        </div>

        <p className="text-sm text-ink-2">
          {alleenHoofdrol
            ? 'Gerechten waarin dit ingrediënt echt de hoofdmoot is, dus waar het restje ook van opgaat.'
            : 'Alle gerechten waar dit in zit, ook als het maar een lepel is.'}
        </p>

        {zichtbaar.length === 0 ? (
          <p className="py-8 text-center text-ink-3">
            {treffers.length === 0
              ? 'Geen enkel recept gebruikt dit ingrediënt.'
              : 'Geen recept waarin dit een hoofdrol speelt. Bekijk "Alles" voor de bijrollen.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {zichtbaar.map((match) => (
              <li key={match.recipe.id}>
                <Link
                  to={`/recept/${match.recipe.id}`}
                  onClick={onClose}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3 active:bg-surface-2"
                >
                  <span className="flex-1">
                    <span className="block font-medium">{match.recipe.title}</span>
                    <span className="block text-xs text-ink-3">
                      {match.quantity ? formatQuantity(match.quantity) : 'naar smaak'} ·{' '}
                      {Math.round(match.share * 100)}% van het gerecht
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
};
