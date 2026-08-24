import { Link } from 'react-router-dom';
import { activeMinutes, totalMinutes, type Recipe } from '../../domain/schema/recipe';
import { formatMinutes } from '../../domain/units/format';
import { useLocalState } from '../../state/localState';
import { Icon } from '../../ui/Icon';
import { Tag } from '../../ui/controls';

export const RecipeCard = ({ recipe, servings }: { recipe: Recipe; servings?: number }) => {
  const { isSelected, toggleSelection } = useLocalState();
  const geselecteerd = isSelected(recipe.id);
  const totaal = totalMinutes(recipe.times);
  const actief = activeMinutes(recipe.times);

  return (
    <li className="rounded-2xl border border-line bg-surface">
      <Link to={`/recept/${recipe.id}`} className="block rounded-t-2xl px-4 pt-4">
        <h3 className="text-[17px] font-semibold leading-snug">{recipe.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-2">{recipe.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Tag>
            <Icon name="klok" className="h-3.5 w-3.5" />
            {formatMinutes(totaal)}
          </Tag>
          {/* Alleen tonen als het verschil er echt toe doet. */}
          {totaal !== actief ? <Tag tone="ok">{formatMinutes(actief)} werk</Tag> : null}
          <Tag>{recipe.difficulty}</Tag>
          {recipe.methods.slice(0, 2).map((method) => (
            <Tag key={method}>{method}</Tag>
          ))}
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line px-2 py-2">
        <Link
          to={`/recept/${recipe.id}`}
          className="flex min-h-11 items-center px-2 text-sm font-medium text-accent"
        >
          Bekijken
        </Link>
        <button
          type="button"
          onClick={() => toggleSelection(recipe.id, servings ?? recipe.servings)}
          aria-pressed={geselecteerd}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium ${
            geselecteerd ? 'bg-ok-soft text-ok' : 'text-ink-2 active:bg-surface-2'
          }`}
        >
          <Icon name={geselecteerd ? 'vink' : 'plus'} className="h-4 w-4" />
          {geselecteerd ? 'Staat op de lijst' : 'Op de lijst'}
        </button>
      </div>
    </li>
  );
};
