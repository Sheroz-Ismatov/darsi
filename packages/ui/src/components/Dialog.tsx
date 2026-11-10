import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Accessible name of the close button. */
  closeLabel: string;
  children: ReactNode;
  /** Action buttons, right-aligned. */
  footer?: ReactNode;
  className?: string;
}

/** Modal on the native <dialog>: focus trap, Esc and the backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[min(520px,calc(100vw-32px))] rounded-xl border border-hairline bg-surface p-0 text-ink shadow-md backdrop:bg-overlay',
        className,
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="m-0 text-[22px] leading-tight font-bold tracking-[-0.02em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-pill text-xl leading-none text-ink-2 transition hover:bg-surface-2"
            >
              ×
            </button>
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
