import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * Een paneel dat van onderen omhoog schuift. Op een telefoon is dat prettiger
 * dan een dialoog in het midden: je duim komt er bij.
 */
export const Sheet = ({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const vorige = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = vorige;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end print-hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Sluiten"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[88vh] flex-col rounded-t-3xl border-t border-line bg-bg shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:bg-surface-2"
            aria-label="Sluiten"
          >
            <Icon name="kruis" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer ? <div className="safe-bottom border-t border-line px-4 pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
};
