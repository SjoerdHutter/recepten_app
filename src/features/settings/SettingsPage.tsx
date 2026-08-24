import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { REPO, repoSlug } from '../../config';
import { kvDump, kvRestore } from '../../data/db/idb';
import { useData } from '../../state/data';
import { useSettings, type Theme } from '../../state/settings';
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
  } = useSettings();
  const { dataset, lastSyncedAt, syncing, syncError, online, pendingDrafts, refresh } = useData();

  const [invoer, setInvoer] = useState('');
  const [melding, setMelding] = useState<string | null>(null);
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
              ? 'Je token heeft schrijfrechten. Vanaf milestone 2 kun je hiermee recepten toevoegen en aanpassen.'
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
      </Sectie>

      {melding ? (
        <p className="text-sm text-ink-2" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
};
