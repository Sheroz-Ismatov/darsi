import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { Eyebrow } from './Eyebrow';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small caption above the title. */
  eyebrow?: ReactNode;
  /** Accessible name of the close button. */
  closeLabel: string;
  children: ReactNode;
  /** Action buttons pinned to the bottom. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Right-hand panel 360 px wide on the native <dialog>, like `Dialog`: focus trap, Esc and the
 * backdrop come from the browser. The body scrolls, the header and footer stay in place.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  closeLabel,
  children,
  footer,
  className,
}: DrawerProps) {
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
        // The browser centres a modal dialog and caps its size; the panel undoes both.
        'm-0 ml-auto h-dvh max-h-none w-[min(360px,100vw)] max-w-none border-0 border-l border-hairline bg-surface p-0 text-ink shadow-md backdrop:bg-overlay',
        className,
      )}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-hairline p-5">
            <div className="min-w-0">
              {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
              <h2 className="m-0 text-[20px] leading-tight font-bold tracking-[-0.02em]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-pill text-xl leading-none text-ink-2 transition hover:bg-surface-2"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap gap-3 border-t border-hairline p-5">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
