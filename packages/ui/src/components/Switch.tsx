import type { ComponentProps } from 'react';
import { cn } from '../cn';

export interface SwitchProps extends Omit<
  ComponentProps<'button'>,
  'onChange' | 'role' | 'type' | 'value'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * On/off pill: ink when on, hairline when off. A button with role="switch", so a
 * `<label htmlFor>` names it and Space/Enter toggle it.
 */
export function Switch({ checked, onChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-pill p-[3px] transition',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
        'disabled:cursor-default disabled:opacity-60',
        checked ? 'bg-ink' : 'bg-hairline',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-[22px] rounded-pill bg-surface shadow-sm transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
