import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Alles wat je aanraakt is minstens 44 px hoog en werkt met één duim. Er zit
 * bewust geen gedrag op hover: op een telefoon bestaat hover niet.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent active:brightness-110',
  secondary: 'bg-surface text-ink border border-line active:bg-surface-2',
  ghost: 'text-ink-2 active:bg-surface-2',
  danger: 'bg-danger-soft text-danger border border-danger/30 active:brightness-95',
};

export const Button = ({
  variant = 'secondary',
  full = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  full?: boolean;
}) => (
  <button
    type="button"
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition-[filter,background-color] disabled:opacity-40 ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const Chip = ({
  active = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) => (
  <button
    type="button"
    aria-pressed={active}
    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
      active
        ? 'border-accent bg-accent text-on-accent'
        : 'border-line bg-surface text-ink-2 active:bg-surface-2'
    } ${className}`}
    {...props}
  >
    {children}
  </button>
);

/** Leesbaar labeltje zonder knopgedrag. */
export const Tag = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warn' | 'ok';
}) => {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2',
    warn: 'bg-warn-soft text-warn',
    ok: 'bg-ok-soft text-ok',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>
);

/** Aantal personen aanpassen met twee grote knoppen in plaats van een invoerveld. */
export const Stepper = ({
  value,
  onChange,
  min = 1,
  max = 24,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}) => (
  <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
    <button
      type="button"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-surface-2 disabled:opacity-30"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      aria-label={`${label} verlagen`}
    >
      <span className="text-xl leading-none">−</span>
    </button>
    <span className="min-w-10 text-center text-base font-semibold tabular-nums" aria-live="polite">
      {value}
    </span>
    <button
      type="button"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink active:bg-surface-2 disabled:opacity-30"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      aria-label={`${label} verhogen`}
    >
      <span className="text-xl leading-none">+</span>
    </button>
  </div>
);
