import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPO, repoSlug } from '../../config';
import { kvDump, kvRestore } from '../../data/db/idb';
import { useData } from '../../state/data';
import { AI_MODELS, useSettings, type Theme } from '../../state/settings';
import { checkForUpdate } from '../../pwa';
import { Icon } from '../../ui/Icon';
import { Button, Card, Chip, Stepper } from '../../ui/controls';

const THEMAS: Array<{ waarde: Theme; label: string }> = [
  { waarde: 'system', label: 'Systeem' },
  { waarde: 'light', label: 'Licht' },
  { waarde: 'dark', label: 'Donker' },
];

const Sectie = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-lg font-semibold">{title}</h2>
    {children}
  </section>
);

export const SettingsPage = () => {
  const {
    token,
    tokenState,
    tokenError,
    canWrite,
    theme,
    defaultServings,
    saveToken,
    clearToken,
    setTheme,
    setDefaultServings,
    importProxy,
    aiKey,
    aiModel,
    canImportUrl,
    canImportPhoto,
    setImportProxy,
    setAiKey,
    setAiModel,
  } = useSettings();
  const { dataset, lastSyncedAt, syncing, syncError, online, pendingDrafts, refresh } = useData();

  const [invoer, setInvoer] = useState('');
  const [proxyInvoer, setProxyInvoer] = useState(importProxy);
  const [sleutelInvoer, setSleutelInvoer] = useState('');
  const [melding, setMelding] = useState<string | null>(null);

  /**
   * Als de helft van de bestanden afketst op een veldnaam, is de app oud en niet
   * de data stuk. Dat is precies wat er gebeurde toen milestone 8 en 9 nieuwe
   * velden toevoegden en er nog een oude service worker draaide.
   */
  const veelSchemafouten =
    dataset.problems.length >= 5 &&
    dataset.problems.every((probleem) => !probleem.message.startsWith('geen geldige YAML'));

  const gebouwdOp = new Date(__APP_GEBOUWD_OP__).toLocaleString('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const werkAppBij = async () => {
    setMelding('Bezig met controleren…');
    await checkForUpdate();
    // Staat er een nieuwe versie klaar, dan neemt de service worker het over en
    // herlaadt de app zichzelf; dan zie je deze melding niet eens.
    setMelding('Je hebt de laatste versie.');
  };
  const bestandKiezer = useRef<HTMLInputElement>(null);

  const exporteer = async () => {
    const gegevens = {
      versie: 1,
      geexporteerdOp: new Date().toISOString(),
      // Het token gaat bewust niet mee in een back-upbestand.
      instellingen: { theme, defaultServings },
      opslag: await kvDump(),
    };
    const blob = new Blob([JSON.stringify(gegevens, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recepten-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMelding('Back-up gedownload.');
  };

  const importeer = async (bestand: File) => {
    try {
      const inhoud = JSON.parse(await bestand.text()) as {
        opslag?: Record<string, unknown>;
        instellingen?: { theme?: Theme; defaultServings?: number };
      };
      if (inhoud.opslag) await kvRestore(inhoud.opslag);
      if (inhoud.instellingen?.theme) setTheme(inhoud.instellingen.theme);
      if (inhoud.instellingen?.defaultServings)
        setDefaultServings(inhoud.instellingen.defaultServings);
      setMelding('Back-up teruggezet. De app wordt opnieuw geladen.');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setMelding('Dat bestand kon ik niet lezen. Is het een back-up van deze app?');
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <h1 className="text-2xl font-semibold">Instellingen</h1>

      <Sectie title="Modus">
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2 font-medium">
            <Icon name={canWrite ? 'potlood' : 'slot'} className="h-5 w-5 text-accent" />
            {canWrite ? 'Schrijfmodus' : 'Leesmodus'}
          </div>
          <p className="mt-1.5 text-sm text-ink-2">
            {canWrite
              ? 'Je token heeft schrijfrechten. Je kunt recepten toevoegen, aanpassen en verwijderen vanuit de app zelf.'
              : 'Zonder token kun je alles lezen, zoeken en boodschappenlijsten maken. Recepten toevoegen gaat dan via GitHub zelf.'}
          </p>
        </Card>
      </Sectie>

      <Sectie title="GitHub-token">
        <Card className="flex flex-col gap-3 px-4 py-3">
          <p className="text-sm text-ink-2">
            Maak een fine-grained token met toegang tot alleen{' '}
            <span className="font-medium">{repoSlug}</span> en de rechten{' '}
            <span className="font-medium">Contents: read and write</span>.
          </p>
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent"
          >
            Token aanmaken op GitHub →
          </a>
          <input
            type="password"
            value={invoer}
            onChange={(event) => setInvoer(event.target.value)}
            placeholder={token ? 'Er staat een token opgeslagen' : 'github_pat_…'}
            autoComplete="off"
            spellCheck={false}
            className="h-12 rounded-xl border border-line bg-surface px-3 font-mono text-sm"
            aria-label="Persoonlijk toegangstoken"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                saveToken(invoer);
                setInvoer('');
                setMelding('Token opgeslagen.');
              }}
              disabled={!invoer.trim() || tokenState === 'controleren'}
            >
              {tokenState === 'controleren' ? 'Controleren…' : 'Opslaan en testen'}
            </Button>
            {token ? (
              <Button
                variant="danger"
                onClick={() => {
                  clearToken();
                  setMelding('Token verwijderd van dit toestel.');
                }}
              >
                Verwijderen
              </Button>
            ) : null}
          </div>
          {tokenState === 'alleen-lezen' ? (
            <p className="text-sm text-warn">
              Dit token werkt, maar heeft geen schrijfrechten op deze repo.
            </p>
          ) : null}
          {tokenState === 'fout' && tokenError ? (
            <p className="text-sm text-danger">{tokenError}</p>
          ) : null}
          <p className="text-xs text-ink-3">
            Het token wordt opgeslagen in de localStorage van deze browser en gaat uitsluitend naar
            api.github.com. Op een gedeeld of onbeheerd toestel kun je het beter niet bewaren. In de
            README staat waarom dat voor persoonlijk gebruik acceptabel is.
          </p>
        </Card>
      </Sectie>

      <Sectie title="Importeren">
        <Card className="flex flex-col gap-4 px-4 py-3">
          <p className="text-sm text-ink-2">
            Twee losse hulpjes voor het toevoegen van een recept. Ze zijn allebei optioneel: laat je
            ze leeg, dan verbergt de app ze en werkt de rest gewoon.
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Proxy voor het importeren van een URL</span>
              <input
                value={proxyInvoer}
                onChange={(event) => setProxyInvoer(event.target.value)}
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://recepten-proxy.jouw-account.workers.dev"
                className="h-12 rounded-xl border border-line bg-surface px-3 font-mono text-sm"
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setImportProxy(proxyInvoer);
                  setMelding(proxyInvoer.trim() ? 'Proxy opgeslagen.' : 'Proxy gewist.');
                }}
              >
                Opslaan
              </Button>
              {canImportUrl ? (
                <span className="flex items-center gap-1.5 text-sm text-ok">
                  <Icon name="vink" className="h-4 w-4" />
                  Ingesteld
                </span>
              ) : null}
            </div>
            <p className="text-xs text-ink-3">
              Een browser mag een receptensite niet rechtstreeks ophalen vanaf een ander adres, dus
              hier is een klein tussenstukje voor nodig. In{' '}
              <a
                href={`https://github.com/${repoSlug}/blob/main/proxy/README.md`}
                target="_blank"
                rel="noreferrer"
                className="text-accent"
              >
                proxy/README.md
              </a>{' '}
              staat hoe je hem in een paar minuten gratis neerzet bij Cloudflare of Netlify.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">API-sleutel voor foto naar recept</span>
              <input
                value={sleutelInvoer}
                onChange={(event) => setSleutelInvoer(event.target.value)}
                type="password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={aiKey ? '••••••••••••' : 'sk-ant-…'}
                className="h-12 rounded-xl border border-line bg-surface px-3 font-mono text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_MODELS.map((model) => (
                <Chip
                  key={model.id}
                  active={aiModel === model.id}
                  onClick={() => setAiModel(model.id)}
                >
                  {model.label}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAiKey(sleutelInvoer);
                  setSleutelInvoer('');
                  setMelding(sleutelInvoer.trim() ? 'Sleutel opgeslagen.' : 'Sleutel gewist.');
                }}
              >
                Opslaan
              </Button>
              {canImportPhoto ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setAiKey('');
                    setSleutelInvoer('');
                    setMelding('Sleutel gewist.');
                  }}
                >
                  Wissen
                </Button>
              ) : null}
              {canImportPhoto ? (
                <span className="flex items-center gap-1.5 text-sm text-ok">
                  <Icon name="vink" className="h-4 w-4" />
                  Ingesteld
                </span>
              ) : null}
            </div>
            <p className="text-xs text-ink-3">
              Maak een sleutel aan op{' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-accent"
              >
                console.anthropic.com
              </a>
              . Eén pagina omzetten kost bij het goedkope model ongeveer een halve cent. De sleutel
              staat net als het GitHub-token in localStorage, gaat uitsluitend naar
              api.anthropic.com en komt niet mee in een back-up.
            </p>
          </div>
        </Card>
      </Sectie>

      <Sectie title="Weergave">
        <div className="flex flex-wrap gap-2">
          {THEMAS.map((optie) => (
            <Chip
              key={optie.waarde}
              active={theme === optie.waarde}
              onClick={() => setTheme(optie.waarde)}
            >
              <Icon name={optie.waarde === 'dark' ? 'maan' : 'zon'} className="h-4 w-4" />
              {optie.label}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-sm">Standaard aantal personen</span>
          <Stepper
            value={defaultServings}
            onChange={setDefaultServings}
            label="Standaard personen"
          />
        </div>
      </Sectie>

      <Sectie title="Gegevens">
        <Card className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink-2">
              {dataset.recipes.length} recepten, {dataset.ingredients.length} ingrediënten
            </span>
            <Button
              variant="secondary"
              onClick={() => void refresh()}
              disabled={syncing || !online}
            >
              <Icon name="vernieuw" className="h-4 w-4" />
              {syncing ? 'Bezig…' : 'Vernieuwen'}
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            {!online
              ? 'Je bent offline. De app werkt gewoon door met wat er lokaal staat.'
              : lastSyncedAt
                ? `Laatst bijgewerkt om ${new Date(lastSyncedAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.`
                : 'Nog niet bijgewerkt sinds het openen.'}
          </p>
          {pendingDrafts > 0 ? (
            <div className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
              {pendingDrafts === 1
                ? '1 recept wacht op verbinding en wordt vanzelf gecommit.'
                : `${pendingDrafts} recepten wachten op verbinding en worden vanzelf gecommit.`}
            </div>
          ) : null}
          {syncError ? <p className="text-sm text-danger">{syncError}</p> : null}
          {dataset.problems.length > 0 ? (
            <div className="rounded-xl bg-warn-soft px-3 py-2">
              <p className="text-sm font-medium text-warn">Deze bestanden kon ik niet lezen:</p>
              {veelSchemafouten ? (
                <p className="mt-1 text-xs text-warn">
                  Zoveel bestanden tegelijk wijst bijna altijd op een verouderde app, niet op
                  kapotte gegevens: deze versie kent velden nog niet die er inmiddels in staan. Werk
                  hem bij met de knop onderaan bij{' '}
                  <span className="font-medium">Over deze app</span>.
                </p>
              ) : null}
              <ul className="mt-1 flex flex-col gap-1 text-xs text-warn">
                {dataset.problems.map((probleem) => (
                  <li key={probleem.path}>
                    <span className="font-mono">{probleem.path}</span> — {probleem.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Link
          to="/bibliotheek"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-4 active:bg-surface-2"
        >
          <span className="flex-1">
            <span className="block font-medium">Ingrediëntenbibliotheek</span>
            <span className="block text-xs text-ink-3">
              Samenvoegen, hernoemen, synoniemen en opruimen
            </span>
          </span>
          <Icon name="omlaag" className="h-4 w-4 -rotate-90 text-ink-3" />
        </Link>
      </Sectie>

      <Sectie title="Back-up">
        <Card className="flex flex-col gap-3 px-4 py-3">
          <p className="text-sm text-ink-2">
            Je selectie, vinkjes en losse items staan alleen op dit toestel. Met een back-up zet je
            ze over naar een ander toestel. Het token gaat niet mee.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void exporteer()}>
              Exporteren
            </Button>
            <Button variant="secondary" onClick={() => bestandKiezer.current?.click()}>
              Importeren
            </Button>
            <input
              ref={bestandKiezer}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const bestand = event.target.files?.[0];
                if (bestand) void importeer(bestand);
                event.target.value = '';
              }}
            />
          </div>
        </Card>
      </Sectie>

      <Sectie title="Over deze app">
        <p className="text-sm text-ink-2">
          De recepten staan als YAML-bestanden in{' '}
          <a
            href={`https://github.com/${repoSlug}/tree/${REPO.branch}/data`}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            {repoSlug}
          </a>
          . Je kunt ze ook rechtstreeks op GitHub aanpassen; de app pikt dat binnen een paar minuten
          op.
        </p>

        <Card className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-2">Versie</span>
            <span className="font-mono text-xs text-ink-2">{__APP_VERSIE__}</span>
          </div>
          <p className="text-xs text-ink-3">Gebouwd op {gebouwdOp}.</p>
          <Button variant="secondary" onClick={() => void werkAppBij()}>
            <Icon name="vernieuw" className="h-4 w-4" />
            Controleren op een nieuwe versie
          </Button>
          <p className="text-xs text-ink-3">
            De app werkt zichzelf bij zodra er een nieuwe versie klaarstaat. Vermoed je dat hij is
            blijven hangen — bijvoorbeeld omdat er recepten ontbreken die er wel horen te zijn — dan
            dwing je het hiermee af.
          </p>
        </Card>
      </Sectie>

      {melding ? (
        <p className="text-sm text-ink-2" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
};
