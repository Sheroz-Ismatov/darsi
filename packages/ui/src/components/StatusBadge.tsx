import type { ComponentProps } from 'react';
import { cn } from '../cn';

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info';

const TONES: Record<StatusTone, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
};

const DOTS: Record<StatusTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn-dot',
  danger: 'bg-danger',
  info: 'bg-info',
};

export interface StatusBadgeProps extends ComponentProps<'span'> {
  tone: StatusTone;
  dot?: boolean;
}

export function StatusBadge({
  tone,
  dot = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export type AttendanceDotState = 'present' | 'absent' | 'unknown';

const ATT_DOT: Record<AttendanceDotState, string> = {
  present: 'bg-ok',
  absent: 'bg-danger',
  unknown: 'bg-hairline',
};

/** Compact attendance marker for history strips. */
export function AttDot({ state, label }: { state: AttendanceDotState; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-block size-2.5 rounded-full', ATT_DOT[state])}
    />
  );
}
