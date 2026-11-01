import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  /** `lg` gives 44 px touch targets — attendance marking in the TMA. */
  size?: 'md' | 'lg';
  className?: string;
}

/** Pill segmented control (prototype "toggle-row"); the active segment is ink. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-1 rounded-pill border border-hairline bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-pill px-4 text-[13px] font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
              size === 'lg' ? 'min-h-11' : 'py-2.5',
              selected ? 'bg-ink text-on-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
