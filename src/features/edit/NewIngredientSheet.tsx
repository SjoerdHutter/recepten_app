import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../domain/schema/enums';
import { ingredientSchema, type Ingredient } from '../../domain/schema/ingredient';
import { slugify } from './draft';
import { UNITS, type Unit } from '../../domain/units/units';
import { Sheet } from '../../ui/Sheet';
import { Button, Chip } from '../../ui/controls';

/**
 * Een ingrediënt dat nog niet bestaat wordt meteen aan de bibliotheek
 * toegevoegd. Zonder categorie en standaardeenheid is het onbruikbaar op de
 * boodschappenlijst, dus die twee worden hier gevraagd en verder niets.
 */
export const NewIngredientSheet = ({
  open,
  naam,
  onClose,
  onCreate,
}: {
  open: boolean;
  naam: string;
  onClose: () => void;
  onCreate: (ingredient: Ingredient) => void;
}) => {
  const [category, setCategory] = useState<Category>('overig');
  const [unit, setUnit] = useState<Unit>('g');
  const [plural, setPlural] = useState('');

  const maak = () => {
    const uitkomst = ingredientSchema.safeParse({
      id: slugify(naam),
      name: naam.trim().toLowerCase(),
      ...(plural.trim() ? { plural: plural.trim().toLowerCase() } : {}),
      category,
      defaultUnit: unit,
    });
    if (!uitkomst.success) return;
    onCreate(uitkomst.data);
    setPlural('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Nieuw ingrediënt"
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button variant="primary" full onClick={maak}>
            Toevoegen aan bibliotheek
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{naam}</span> staat nog niet in de bibliotheek.
          Met een categorie en een eenheid telt hij straks netjes op in de boodschappenlijst.
        </p>

        <div>
          <h3 className="mb-2 text-sm font-semibold">In welk schap ligt het?</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((optie) => (
              <Chip key={optie} active={category === optie} onClick={() => setCategory(optie)}>
                {CATEGORY_LABELS[optie]}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Waarin koop of meet je het?</h3>
          <div className="flex flex-wrap gap-2">
            {UNITS.map((optie) => (
              <Chip key={optie} active={unit === optie} onClick={() => setUnit(optie)}>
                {optie}
              </Chip>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Meervoud (optioneel)</span>
          <input
            value={plural}
            onChange={(event) => setPlural(event.target.value)}
            placeholder="bijvoorbeeld uien"
            className="h-12 rounded-xl border border-line bg-surface px-3"
          />
          <span className="text-xs text-ink-3">
            Zonder meervoud staat er straks &ldquo;2 {naam}&rdquo; in plaats van &ldquo;2 {naam}
            en&rdquo;.
          </span>
        </label>
      </div>
    </Sheet>
  );
};
