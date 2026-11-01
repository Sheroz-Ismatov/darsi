import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'lime' | 'ghost';
export type ButtonSize = 'md' | 'sm' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink hover:opacity-90',
  lime: 'bg-lime text-on-accent hover:bg-lime-deep',
  ghost: 'border border-hairline bg-surface text-ink hover:bg-surface-2',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'px-5 py-3 text-[15px]',
  sm: 'px-3.5 py-2 text-[13px]',
  icon: 'size-10 justify-center p-0',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width (mobile CTAs). */
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-pill font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
        'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full justify-center',
        className,
      )}
      {...props}
    />
  );
}
