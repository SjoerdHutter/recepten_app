import { useMemo, useRef, useState } from 'react';
import { addIngredients } from '../../domain/ingredients/edits';
import { createLibrary, normalizeName } from '../../domain/ingredients/library';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '../../domain/schema/enums';
import { ingredientSchema, type Ingredient } from '../../domain/schema/ingredient';
import { UNITS, type Unit } from '../../domain/units/units';
import { slugify } from '../edit/draft';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Button, Chip } from '../../ui/controls';
import type { useLibraryEdit } from './useLibraryEdit';

/**
 * Bulk import, vooral handig bij de start. Twee vormen worden herkend: een JSON
 * export van deze app, en een simpele lijst namen. Wat al bestaat wordt
 * overgeslagen in plaats van dubbel toegevoegd.
 *
 * Regel per naam, met optioneel schap en eenheid:
 *   sjalot
 *   sjalot | groente-en-fruit | stuks
 */

interface ImportRegel {
  ingredient: Ingredient;
  bestaatAl: boolean;
  bestaandeNaam?: string;
}

const leesLijst = (
  tekst: string,
  standaardCategorie: Category,
  standaardEenheid: Unit,
): Ingredient[] => {
  const uit: Ingredient[] = [];
  for (const ruweRegel of tekst.split('\n')) {
    const regel = ruweRegel.trim();
    if (!regel || regel.startsWith('#')) continue;
    const delen = regel.split('|').map((deel) => deel.trim());
    const naam = delen[0];
    if (!naam) continue;
    const categorie = delen[1] && CATEGORIES.includes(delen[1] as Category) ? delen[1] : undefined;
    const eenheid = delen[2] && UNITS.includes(delen[2] as Unit) ? delen[2] : undefined;
    const uitkomst = ingredientSchema.safeParse({
      id: slugify(naam),
      name: naam.toLowerCase(),
      category: categorie ?? standaardCategorie,
      defaultUnit: eenheid ?? standaardEenheid,
    });
    if (uitkomst.success) uit.push(uitkomst.data);
  }
  return uit;
};

const leesJson = (tekst: string): Ingredient[] | null => {
  let ruw: unknown;
  try {
    ruw = JSON.parse(tekst);
  } catch {
    return null;
  }
  const lijst = Array.isArray(ruw) ? ruw : [ruw];
  const uit: Ingredient[] = [];
  for (const item of lijst) {
    const uitkomst = ingredientSchema.safeParse(item);
    if (uitkomst.success) uit.push(uitkomst.data);
  }
  return uit;
};

export const ImportSheet = ({
  open,
  onClose,
  editor,
}: {
  open: boolean;
  onClose: () => void;
  editor: ReturnType<typeof useLibraryEdit>;
}) => {
  const { state, apply, status, canWrite } = editor;
  const [tekst, setTekst] = useState('');
  const [categorie, setCategorie] = useState<Category>('overig');
  const [eenheid, setEenheid] = useState<Unit>('g');
  const bestandInvoer = useRef<HTMLInputElement>(null);

  const bibliotheek = useMemo(() => createLibrary(state.ingredients), [state.ingredients]);

  const regels = useMemo<ImportRegel[]>(() => {
    if (!tekst.trim()) return [];
    const gelezen = leesJson(tekst) ?? leesLijst(tekst, categorie, eenheid);
    const bestaandeIds = new Set(state.ingredients.map((item) => item.id));
    const gezien = new Set<string>();
    const uit: ImportRegel[] = [];
    for (const ingredient of gelezen) {
      const sleutel = normalizeName(ingredient.name);
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      // Een naam die al onder een synoniem bekend is, is óók een dubbeling.
      const treffer = bibliotheek.match(ingredient.name);
      uit.push({
        ingredient,
        bestaatAl: bestaandeIds.has(ingredient.id) || Boolean(treffer),
        ...(treffer ? { bestaandeNaam: treffer.name } : {}),
      });
    }
    return uit;
  }, [tekst, categorie, eenheid, state.ingredients, bibliotheek]);

  const nieuwe = regels.filter((regel) => !regel.bestaatAl);

  const kiesBestanden = async (bestanden: FileList | null) => {
    if (!bestanden || bestanden.length === 0) return;
    const inhoud = await Promise.all(Array.from(bestanden).map((bestand) => bestand.text()));
    setTekst(inhoud.join('\n'));
  };

  const exporteer = () => {
    const blob = new Blob([JSON.stringify(state.ingredients, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ingredienten-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Ingrediënten importeren"
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Sluiten
          </Button>
          <Button
            variant="primary"
            full
            disabled={nieuwe.length === 0 || status.busy || !canWrite}
            onClick={() =>
              void apply((s) =>
                addIngredients(
                  s,
                  nieuwe.map((regel) => regel.ingredient),
                ),
              ).then((ok) => {
                if (ok) setTekst('');
              })
            }
          >
            {nieuwe.length === 0 ? 'Niets nieuws' : `${nieuwe.length} toevoegen aan de bibliotheek`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {status.error ? (
          <p className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {status.error}
          </p>
        ) : null}
        {status.success ? (
          <p className="rounded-xl bg-ok-soft px-3 py-2.5 text-sm text-ok">{status.success}</p>
        ) : null}

        <p className="text-sm text-ink-2">
          Plak een JSON-export of een lijst met namen, één per regel. Optioneel met schap en eenheid
          erachter, gescheiden door een verticale streep.
        </p>

        <div className="flex gap-2">
          <Button onClick={() => bestandInvoer.current?.click()}>
            <Icon name="plus" className="h-4 w-4" />
            Bestanden kiezen
          </Button>
          <Button onClick={exporteer}>
            <Icon name="delen" className="h-4 w-4" />
            Exporteren
          </Button>
        </div>
        <input
          ref={bestandInvoer}
          type="file"
          accept=".json,.txt,.md,text/plain,application/json"
          multiple
          className="hidden"
          onChange={(event) => void kiesBestanden(event.target.files)}
        />

        <textarea
          value={tekst}
          onChange={(event) => setTekst(event.target.value)}
          rows={8}
          placeholder={'sjalot\nsereh | kruiden | stengel\npastinaak | groente-en-fruit | stuks'}
          className="min-h-40 rounded-xl border border-line bg-surface p-3 font-mono text-sm"
          aria-label="Te importeren ingrediënten"
        />

        <details>
          <summary className="cursor-pointer text-sm text-ink-3">
            Standaard schap en eenheid voor regels zonder
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((optie) => (
                <Chip key={optie} active={categorie === optie} onClick={() => setCategorie(optie)}>
                  {CATEGORY_LABELS[optie]}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map((optie) => (
                <Chip key={optie} active={eenheid === optie} onClick={() => setEenheid(optie)}>
                  {optie}
                </Chip>
              ))}
            </div>
          </div>
        </details>

        {regels.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              {nieuwe.length} nieuw, {regels.length - nieuwe.length} bestaat al
            </h3>
            <ul className="flex flex-col gap-1">
              {regels.slice(0, 40).map((regel) => (
                <li
                  key={regel.ingredient.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
                >
                  <span className={regel.bestaatAl ? 'text-ink-3 line-through' : ''}>
                    {regel.ingredient.name}
                  </span>
                  <span className="text-xs text-ink-3">
                    {regel.bestaatAl
                      ? `al bekend${regel.bestaandeNaam && regel.bestaandeNaam !== regel.ingredient.name ? ` als ${regel.bestaandeNaam}` : ''}`
                      : CATEGORY_LABELS[regel.ingredient.category]}
                  </span>
                </li>
              ))}
            </ul>
            {regels.length > 40 ? (
              <p className="mt-1 text-xs text-ink-3">… en nog {regels.length - 40}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
};
