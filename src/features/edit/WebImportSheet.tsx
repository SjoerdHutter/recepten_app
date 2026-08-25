import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askModelAboutPhoto, ModelError } from '../../data/import/askModel';
import { fetchRecipeImage, fetchRecipePage, ImportError } from '../../data/import/fetchPage';
import { resizeToWebp, type ResizedImage } from '../../data/images/resize';
import { importFromHtml } from '../../domain/import/jsonld';
import { extractJson, photoToRecipe } from '../../domain/import/photo';
import type { IngredientLibrary } from '../../domain/ingredients/library';
import type { ParsedRecipe } from '../../domain/text/parse';
import { useSettings } from '../../state/settings';
import { Sheet } from '../../ui/Sheet';
import { Button, Card } from '../../ui/controls';

/**
 * De twee optionele importroutes: een adres van een receptensite, of een foto
 * van een kookboekpagina. Ze staan hier in één venster omdat ze op precies
 * hetzelfde uitkomen — een `ParsedRecipe` die het formulier vult — en omdat je
 * er hetzelfde mee doet: kijken of het klopt en dan overnemen.
 *
 * Wat niet ingesteld is, wordt niet getoond. Zonder proxy en zonder sleutel
 * opent dit venster helemaal niet.
 */

type Modus = 'url' | 'foto';

const Waarschuwing = ({ tekst }: { tekst: string }) => (
  <li className="flex gap-2 text-xs text-warn">
    <span aria-hidden="true">•</span>
    {tekst}
  </li>
);

const Voorbeeld = ({ resultaat }: { resultaat: ParsedRecipe }) => (
  <Card className="flex flex-col gap-2 px-3 py-2.5 text-sm">
    <p className="font-medium">{resultaat.title}</p>
    <p className="text-ink-2">
      {resultaat.ingredients.length}{' '}
      {resultaat.ingredients.length === 1 ? 'ingrediënt' : 'ingrediënten'}, {resultaat.steps.length}{' '}
      {resultaat.steps.length === 1 ? 'stap' : 'stappen'}
      {resultaat.servings ? `, voor ${resultaat.servings} personen` : ''}
    </p>

    {resultaat.warnings?.length ? (
      <ul className="flex flex-col gap-1">
        {resultaat.warnings.map((tekst) => (
          <Waarschuwing key={tekst} tekst={tekst} />
        ))}
      </ul>
    ) : null}

    {resultaat.leftovers.length > 0 ? (
      <details>
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
  </Card>
);

export const WebImportSheet = ({
  open,
  library,
  onClose,
  onApply,
}: {
  open: boolean;
  library: IngredientLibrary;
  onClose: () => void;
  onApply: (parsed: ParsedRecipe, foto?: ResizedImage) => void;
}) => {
  const { importProxy, aiKey, aiModel, canImportUrl, canImportPhoto } = useSettings();
  const [modus, setModus] = useState<Modus>(canImportUrl ? 'url' : 'foto');
  const [adres, setAdres] = useState('');
  const [bron, setBron] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [resultaat, setResultaat] = useState<ParsedRecipe | null>(null);
  const [foto, setFoto] = useState<ResizedImage | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerijRef = useRef<HTMLInputElement>(null);

  const opnieuw = () => {
    setResultaat(null);
    setFoto(null);
    setFout(null);
  };

  const haalPagina = async () => {
    setBezig(true);
    setFout(null);
    try {
      const pagina = await fetchRecipePage(importProxy, adres);
      const gelezen = importFromHtml(pagina.html, { url: pagina.url, library });
      if (!gelezen) {
        setFout(
          'Op deze pagina staan geen receptgegevens die de app kan lezen. Kopieer de tekst en gebruik "Een heel recept plakken".',
        );
        return;
      }
      setResultaat(gelezen);

      // De foto er los bij: mislukt dat, dan is het recept nog steeds bruikbaar.
      if (gelezen.image) {
        try {
          setFoto(await resizeToWebp(await fetchRecipeImage(importProxy, gelezen.image)));
        } catch {
          setFoto(null);
        }
      }
    } catch (error) {
      setFout(
        error instanceof ImportError
          ? error.message
          : 'Het ophalen ging mis. Probeer het nog eens.',
      );
    } finally {
      setBezig(false);
    }
  };

  const leesFoto = async (bestand: File | undefined) => {
    if (!bestand) return;
    setBezig(true);
    setFout(null);
    try {
      const verkleind = await resizeToWebp(bestand);
      const antwoord = await askModelAboutPhoto(
        new Blob([verkleind.bytes as BlobPart], { type: 'image/webp' }),
        aiKey,
        aiModel,
      );
      const gelezen = photoToRecipe(extractJson(antwoord), library, bron.trim() || undefined);
      if (!gelezen.ingredients.length && !gelezen.steps.length) {
        setFout('Het model zag hier geen recept op. Staat de hele pagina scherp in beeld?');
        return;
      }
      setResultaat(gelezen);
      // De foto van een kookboekpagina is geen foto van het gerecht, dus die
      // wordt niet als receptfoto voorgesteld.
    } catch (error) {
      setFout(
        error instanceof ModelError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Het omzetten ging mis.',
      );
    } finally {
      setBezig(false);
    }
  };

  const overnemen = () => {
    if (!resultaat) return;
    onApply(resultaat, foto ?? undefined);
    setAdres('');
    setBron('');
    opnieuw();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recept importeren"
      footer={
        <div className="flex gap-2 pb-1">
          <Button variant="ghost" onClick={onClose}>
            Annuleren
          </Button>
          {resultaat ? (
            <Button variant="primary" full onClick={overnemen}>
              Overnemen in het formulier
            </Button>
          ) : modus === 'url' ? (
            <Button variant="primary" full disabled={bezig || !adres.trim()} onClick={haalPagina}>
              {bezig ? 'Ophalen…' : 'Ophalen'}
            </Button>
          ) : (
            <Button
              variant="primary"
              full
              disabled={bezig}
              onClick={() => cameraRef.current?.click()}
            >
              {bezig ? 'Bezig met lezen…' : 'Foto maken'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {canImportUrl && canImportPhoto ? (
          <div
            className="flex rounded-xl border border-line bg-surface p-1"
            role="tablist"
            aria-label="Manier van importeren"
          >
            {(
              [
                ['url', 'Vanaf een website'],
                ['foto', 'Vanaf een foto'],
              ] as Array<[Modus, string]>
            ).map(([waarde, label]) => (
              <button
                key={waarde}
                type="button"
                role="tab"
                aria-selected={modus === waarde}
                onClick={() => {
                  setModus(waarde);
                  opnieuw();
                }}
                className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
                  modus === waarde ? 'bg-accent text-on-accent' : 'text-ink-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {modus === 'url' ? (
          <>
            <p className="text-sm text-ink-2">
              Plak de link naar het recept. De app haalt de pagina op via je eigen proxy en leest de
              receptgegevens die er in de bron staan.
            </p>
            <input
              value={adres}
              onChange={(event) => {
                setAdres(event.target.value);
                opnieuw();
              }}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="https://…"
              aria-label="Adres van het recept"
              className="h-12 rounded-xl border border-line bg-surface px-3"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Fotografeer een kookboekpagina of een kaartje. Een taalmodel typt over wat het ziet;
              daarna loop je het na. Zorg dat de hele pagina scherp in beeld staat.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Bron</span>
              <input
                value={bron}
                onChange={(event) => setBron(event.target.value)}
                placeholder="Bijvoorbeeld Ottolenghi Simpel, blz. 84"
                className="h-12 rounded-xl border border-line bg-surface px-3"
              />
            </label>
            <Button
              variant="secondary"
              disabled={bezig}
              onClick={() => galerijRef.current?.click()}
            >
              Uit je galerij kiezen
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => void leesFoto(event.target.files?.[0])}
            />
            <input
              ref={galerijRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void leesFoto(event.target.files?.[0])}
            />
          </>
        )}

        {fout ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {fout}
          </p>
        ) : null}

        {resultaat ? (
          <>
            <Voorbeeld resultaat={resultaat} />
            {foto ? (
              <div className="flex items-center gap-3">
                <img src={foto.previewUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <p className="text-xs text-ink-3">
                  De foto van de bronpagina komt mee. Verwijderen kan straks in het formulier.
                </p>
              </div>
            ) : null}
            <p className="text-xs text-ink-3">
              Neem alleen over wat je zelf mag bewaren. Een recept overtypen voor eigen gebruik is
              iets anders dan de tekst van iemand anders in een openbare repo zetten; zet er in elk
              geval de bron bij.
            </p>
          </>
        ) : null}

        <p className="text-xs text-ink-3">
          Werkt dit niet zoals je wilt? De instellingen voor de proxy en de API-sleutel staan bij{' '}
          <Link to="/instellingen" className="text-accent">
            Instellingen ▸ Importeren
          </Link>
          .
        </p>
      </div>
    </Sheet>
  );
};
