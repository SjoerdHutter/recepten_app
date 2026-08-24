import { formatClock } from '../../domain/text/timers';
import { remainingSeconds, useTimers, type Timer } from '../../state/timers';
import { Icon } from '../../ui/Icon';

/**
 * Lopende timers, altijd zichtbaar boven de navigatie. Ook als je de kookmodus
 * verlaat om iets op te zoeken: een timer die je niet ziet is geen timer.
 */
const TimerRegel = ({ timer, now }: { timer: Timer; now: number }) => {
  const { cancel, dismiss, extend } = useTimers();
  const resterend = remainingSeconds(timer, now);
  const verhouding = timer.durationSeconds > 0 ? 1 - resterend / timer.durationSeconds : 1;

  if (timer.ringing) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2">
        <span className="flex-1 text-sm font-semibold text-danger">{timer.label} is klaar</span>
        <button
          type="button"
          onClick={() => extend(timer.id, 2)}
          className="min-h-9 rounded-lg bg-surface px-2.5 text-xs font-medium text-ink"
        >
          +2 min
        </button>
        <button
          type="button"
          onClick={() => dismiss(timer.id)}
          className="min-h-9 rounded-lg bg-danger px-3 text-xs font-medium text-white"
        >
          Klaar
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2 overflow-hidden rounded-xl bg-surface-2 px-3 py-2">
      <span
        className="absolute inset-y-0 left-0 bg-accent-soft"
        style={{ width: `${Math.min(100, verhouding * 100)}%` }}
        aria-hidden
      />
      <span className="relative flex-1 truncate text-sm">{timer.label}</span>
      <span className="relative tabular-nums text-sm font-semibold">{formatClock(resterend)}</span>
      <button
        type="button"
        onClick={() => cancel(timer.id)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-3"
        aria-label={`Timer ${timer.label} stoppen`}
      >
        <Icon name="kruis" className="h-4 w-4" />
      </button>
    </div>
  );
};

export const TimerBar = ({ inset = true }: { inset?: boolean }) => {
  const { timers, now } = useTimers();
  if (timers.length === 0) return null;

  return (
    <div
      className={`z-40 mx-auto w-full max-w-2xl px-4 print-hidden ${
        inset ? 'fixed inset-x-0 bottom-16' : ''
      }`}
    >
      <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-bg/95 p-1.5 shadow-lg backdrop-blur">
        {timers.map((timer) => (
          <TimerRegel key={timer.id} timer={timer} now={now} />
        ))}
      </div>
    </div>
  );
};
