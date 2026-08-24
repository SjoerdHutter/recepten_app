import { useMemo, useState } from 'react';
import type { IngredientLibrary } from '../../domain/ingredients/library';
import { parseRecipeText, type ParsedRecipe } from '../../domain/text/parse';
import { Sheet } from '../../ui/Sheet';
import { Button } from '../../ui/controls';

/**
 * Een heel recept plakken en de app er iets van laten maken. Wat de parser niet
 * zeker weet blijft staan als "niet geplaatst", zodat je het zelf kunt oplossen
 * in plaats van dat er stilletjes iets verdwijnt.
 */
export const PasteSheet = ({
  open,
  library,
  onClose,
  onApply,
}: {
  open: boolean;
  library: IngredientLibrary;
  onClose: () => void;
  onApply: (parsed: ParsedRecipe) => void;
}) => {
  const [tekst, setTekst] = useState('');
  const resultaat = useMemo(
    () => (tekst.trim() ? parseRecipeText(tekst, library) : null),
    [tekst, library],
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recept plakken"
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            variant="primary"
            full
            disabled={!resultaat}
            onClick={() => {
              if (!resultaat) return;
              onApply(resultaat);
              setTekst('');
              onClose();
            }}
          >
            Overnemen in het formulier
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          Plak de tekst van een recept. De app haalt eruit wat hij herkent; daarna loop je het
          formulier na en past aan wat er niet klopt.
        </p>
        <textarea
          value={tekst}
          onChange={(event) => setTekst(event.target.value)}
          rows={10}
          placeholder={'Uiensoep\n\nVoor 4 personen\n\n3 uien\n1 el olijfolie\n\nSnipper de uien.'}
          className="min-h-56 rounded-xl border border-line bg-surface p-3 font-mono text-sm"
          aria-label="Recepttekst"
        />

        {resultaat ? (
          <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
            <p className="font-medium">{resultaat.title}</p>
            <p className="mt-1 text-ink-2">
              {resultaat.ingredients.length} ingrediënten, {resultaat.steps.length} stappen
              {resultaat.servings ? `, voor ${resultaat.servings} personen` : ''}
            </p>
            {resultaat.ingredients.some((regel) => !regel.ingredientId) ? (
              <p className="mt-1 text-xs text-warn">
                {resultaat.ingredients.filter((regel) => !regel.ingredientId).length} ingrediënten
                staan nog niet in de bibliotheek; die koppel je in het formulier.
              </p>
            ) : null}
            {resultaat.leftovers.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-ink-3">
                  {resultaat.leftovers.length} regels niet geplaatst
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-3">
                  {resultaat.leftovers.map((regel, index) => (
                    <li key={index}>{regel}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
};
