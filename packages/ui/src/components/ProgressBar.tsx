import { cn } from '../cn';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible description, e.g. "Использовано 6 из 9 занятий". */
  label: string;
  /** Fill color class; ink by default. */
  fillClassName?: string;
  className?: string;
}

/** Subscription usage, group load. */
export function ProgressBar({ value, max, label, fillClassName, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 overflow-hidden rounded-pill bg-hairline', className)}
    >
      <span
        className={cn('block h-full rounded-pill bg-ink', fillClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
