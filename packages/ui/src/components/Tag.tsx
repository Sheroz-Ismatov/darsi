import type { ComponentProps } from 'react';
import { cn } from '../cn';

export function Tag({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink',
        className,
      )}
      {...props}
    />
  );
}

export interface ChipProps extends ComponentProps<'button'> {
  active?: boolean;
}

/** Filter pill; the active one is ink. */
export function Chip({ active = false, type = 'button', className, ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-pill border px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition',
        active
          ? 'border-ink bg-ink text-on-ink'
          : 'border-hairline bg-surface text-ink-2 hover:border-ink',
        className,
      )}
      {...props}
    />
  );
}
