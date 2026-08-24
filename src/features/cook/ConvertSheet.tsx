import { useState } from 'react';
import {
  BLIK_TABEL,
  DROOG_GEKOOKT,
  GANGBARE_VORMEN,
  compareTins,
  describeTin,
  type Tin,
} from '../../domain/cooking/convert';
import { formatNumber } from '../../domain/units/format';
import { Sheet } from '../../ui/Sheet';
import { Chip } from '../../ui/controls';

/**
 * Het omrekenhulpje. Alles hier is een vuistregel en dat staat er ook bij: een
 * taart is geen natuurkundeopgave. Wat de app wél kan doen is het rekenwerk
 * overnemen en zeggen vanaf wanneer je moet gaan kijken.
 */
export const ConvertSheet = ({
  open,
  onClose,
  bakeMinutes,
}: {
  open: boolean;
  onClose: () => void;
  bakeMinutes?: number | undefined;
}) => {
  const [tab, setTab] = useState<'vorm' | 'blik' | 'droog'>('vorm');
  const [van, setVan] = useState<Tin>({ shape: 'rond', diameter: 24 });
  const [naar, setNaar] = useState<Tin>({ shape: 'rond', diameter: 20 });

  const advies = compareTins(van, naar, bakeMinutes);
  const groter = advies.ratio > 1;

  return (
    <Sheet open={open} onClose={onClose} title="Omrekenen">
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ['vorm', 'Ovenschaal'],
              ['blik', 'Blik naar vers'],
              ['droog', 'Droog gekookt'],
            ] as const
          ).map(([waarde, label]) => (
            <button
              key={waarde}
              type="button"
              onClick={() => setTab(waarde)}
              aria-pressed={tab === waarde}
              className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${
                tab === waarde ? 'bg-surface text-ink shadow-sm' : 'text-ink-2'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'vorm' ? (
          <>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Het recept is voor</h3>
              <div className="flex flex-wrap gap-1.5">
                {GANGBARE_VORMEN.map((vorm) => (
                  <Chip
                    key={describeTin(vorm)}
                    active={describeTin(van) === describeTin(vorm)}
                    onClick={() => setVan(vorm)}
                  >
                    {describeTin(vorm)}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Jij hebt</h3>
              <div className="flex flex-wrap gap-1.5">
                {GANGBARE_VORMEN.map((vorm) => (
                  <Chip
                    key={describeTin(vorm)}
                    active={describeTin(naar) === describeTin(vorm)}
                    onClick={() => setNaar(vorm)}
                  >
                    {describeTin(vorm)}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm text-ink-2">
                Jouw vorm heeft{' '}
                <span className="font-semibold text-ink">
                  {formatNumber(Math.abs(advies.ratio - 1) * 100, 0)}% {groter ? 'meer' : 'minder'}{' '}
                  bodem
                </span>{' '}
                ({Math.round(advies.fromArea)} → {Math.round(advies.toArea)} cm²). Een doorsnede
                zegt minder dan je denkt: 24 cm is niet 20% maar 44% groter dan 20 cm.
              </p>

              <p className="mt-3 text-sm">
                <span className="font-semibold">Beste aanpak:</span> vermenigvuldig de hoeveelheden
                met{' '}
                <span className="font-semibold text-accent">{formatNumber(advies.scaleBy, 2)}</span>
                . De laag blijft dan even dik en de baktijd klopt gewoon.
              </p>

              {advies.checkFromMinutes !== undefined ? (
                <p className="mt-2 text-sm text-ink-2">
                  <span className="font-semibold text-ink">Houd je de hoeveelheden gelijk?</span>{' '}
                  Dan wordt het {groter ? 'dunner' : 'dikker'}. Ga kijken vanaf ongeveer{' '}
                  {advies.checkFromMinutes} minuten in plaats van {bakeMinutes}, en vertrouw op de
                  satéprikker.
                </p>
              ) : null}

              <p className="mt-3 text-xs text-ink-3">
                Vuistregels, geen exacte wetenschap. Ovens verschillen meer dan deze getallen.
              </p>
            </div>
          </>
        ) : null}

        {tab === 'blik' ? (
          <ul className="flex flex-col gap-2">
            {BLIK_TABEL.map((regel) => (
              <li key={regel.can} className="rounded-2xl border border-line bg-surface p-3">
                <p className="font-medium">{regel.can}</p>
                <p className="mt-0.5 text-sm">
                  <span className="text-ink-2">{regel.canAmount}</span>
                  <span className="mx-2 text-ink-3">≈</span>
                  <span className="font-medium">{regel.fresh}</span>
                </p>
                {regel.note ? <p className="mt-1 text-xs text-ink-3">{regel.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {tab === 'droog' ? (
          <>
            <p className="text-sm text-ink-2">
              Vraagt een recept om gekookte rijst en heb jij alleen droge, of andersom.
            </p>
            <ul className="flex flex-col gap-1.5">
              {DROOG_GEKOOKT.map((regel) => (
                <li
                  key={regel.naam}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <span className="flex-1 font-medium">{regel.naam}</span>
                  <span className="text-sm text-ink-2">{regel.droog} droog</span>
                  <span className="text-ink-3">≈</span>
                  <span className="text-sm font-medium">{regel.gekookt} gekookt</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Sheet>
  );
};
