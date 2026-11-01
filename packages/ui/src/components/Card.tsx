import type { ComponentProps, ReactNode } from 'react';
import type { CourseColor } from '@darsi/shared';
import { cn } from '../cn';
import { Eyebrow } from './Eyebrow';

/** Background class for each course pastel. */
export const PASTEL_BG: Record<CourseColor, string> = {
  lime: 'bg-c-lime',
  peach: 'bg-c-peach',
  coral: 'bg-c-coral',
  lavender: 'bg-c-lavender',
  mint: 'bg-c-mint',
  butter: 'bg-c-butter',
};

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-lg border border-hairline bg-surface p-5', className)} {...props} />
  );
}

export interface PastelCardProps extends ComponentProps<'div'> {
  color: CourseColor;
}

/** Borderless card on a course pastel: catalog cards, lesson headers, subscriptions. */
export function PastelCard({ color, className, ...props }: PastelCardProps) {
  return <div className={cn('rounded-lg p-5 text-ink', PASTEL_BG[color], className)} {...props} />;
}

export interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  color: CourseColor;
  className?: string;
}

export function KpiTile({ label, value, hint, color, className }: KpiTileProps) {
  return (
    <PastelCard color={color} className={cn('p-[18px]', className)}>
      <Eyebrow className="mb-0 text-ink/70">{label}</Eyebrow>
      <div className="mt-2 text-[32px] leading-tight font-bold tracking-[-0.03em]">{value}</div>
      {hint && <div className="text-[13px] opacity-85">{hint}</div>}
    </PastelCard>
  );
}

export interface DarkCardProps extends ComponentProps<'div'> {
  children: ReactNode;
}

/** Ink card with the dotted pattern: "next lesson", bot hints. */
export function DarkCard({ className, children, ...props }: DarkCardProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg bg-ink p-[18px] text-on-ink', className)}
      {...props}
    >
      <div className="pattern-dots" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}
