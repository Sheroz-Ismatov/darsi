import type { ComponentProps } from 'react';
import { cn } from '../cn';

/** Monospace uppercase caption above headings. */
export function Eyebrow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mb-2 font-mono text-[11px] tracking-[0.1em] text-muted uppercase', className)}
      {...props}
    />
  );
}
