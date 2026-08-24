import { useState } from 'react';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/controls';
import { legeStap, type DraftStep } from './draft';

/**
 * Stappen als losse velden in plaats van één groot tekstvak. Dat is meer werk om
 * te typen, maar de kookmodus in milestone 5 kan er dan echt doorheen lopen, en
 * de timer per stap hoort ergens vast te zitten.
 */
const Stap = ({
  stap,
  nummer,
  onChange,
  onRemove,
  onMove,
  kanOmhoog,
  kanOmlaag,
}: {
  stap: DraftStep;
  nummer: number;
  onChange: (stap: DraftStep) => void;
  onRemove: () => void;
  onMove: (richting: -1 | 1) => void;
  kanOmhoog: boolean;
  kanOmlaag: boolean;
}) => {
  const [meer, setMeer] = useState(Boolean(stap.timer || stap.ovenTemp));

  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {nummer}
        </span>
        <textarea
          value={stap.text}
          onChange={(event) => onChange({ ...stap, text: event.target.value })}
          rows={3}
          placeholder="Beschrijf deze stap"
          className="min-h-24 flex-1 rounded-xl border border-line bg-bg p-3"
          aria-label={`Stap ${nummer}`}
        />
      </div>

      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMeer(!meer)}
          className="flex min-h-9 items-center gap-1 px-1 text-sm text-ink-3"
        >
          <Icon name="klok" className="h-4 w-4" />
          {stap.timer || stap.ovenTemp
            ? [stap.timer ? `${stap.timer} min` : '', stap.ovenTemp ? `${stap.ovenTemp} °C` : '']
                .filter(Boolean)
                .join(' · ')
            : 'Timer of oven'}
        </button>
        <div className="ml-auto flex">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!kanOmhoog}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3 disabled:opacity-30"
            aria-label="Stap omhoog"
          >
            <Icon name="omlaag" className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!kanOmlaag}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3 disabled:opacity-30"
            aria-label="Stap omlaag"
          >
            <Icon name="omlaag" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3"
            aria-label="Stap verwijderen"
          >
            <Icon name="kruis" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {meer ? (
        <div className="mt-1 flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-3">
            Timer in minuten
            <input
              value={stap.timer}
              onChange={(event) => onChange({ ...stap, timer: event.target.value })}
              inputMode="numeric"
              placeholder="10"
              className="h-11 rounded-xl border border-line bg-bg px-3 tabular-nums"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-3">
            Oven in graden
            <input
              value={stap.ovenTemp}
              onChange={(event) => onChange({ ...stap, ovenTemp: event.target.value })}
              inputMode="numeric"
              placeholder="180"
              className="h-11 rounded-xl border border-line bg-bg px-3 tabular-nums"
            />
          </label>
        </div>
      ) : null}
    </li>
  );
};

export const StepRows = ({
  stappen,
  onChange,
}: {
  stappen: DraftStep[];
  onChange: (stappen: DraftStep[]) => void;
}) => (
  <div className="flex flex-col gap-3">
    <ul className="flex flex-col gap-3">
      {stappen.map((stap, index) => (
        <Stap
          key={stap.key}
          stap={stap}
          nummer={index + 1}
          kanOmhoog={index > 0}
          kanOmlaag={index < stappen.length - 1}
          onChange={(nieuw) =>
            onChange(stappen.map((bestaand, i) => (i === index ? nieuw : bestaand)))
          }
          onRemove={() =>
            onChange(stappen.length > 1 ? stappen.filter((_, i) => i !== index) : [legeStap()])
          }
          onMove={(richting) => {
            const doel = index + richting;
            if (doel < 0 || doel >= stappen.length) return;
            const kopie = [...stappen];
            const [verplaatst] = kopie.splice(index, 1);
            if (verplaatst) kopie.splice(doel, 0, verplaatst);
            onChange(kopie);
          }}
        />
      ))}
    </ul>
    <Button variant="secondary" full onClick={() => onChange([...stappen, legeStap()])}>
      <Icon name="plus" className="h-4 w-4" />
      Nog een stap
    </Button>
  </div>
);
