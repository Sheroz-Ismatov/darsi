import type { ReactNode } from 'react';
import { COURSE_COLORS } from '@darsi/shared';
import { cn } from '../cn';
import { PASTEL_BG } from './Card';

export interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

/** Initial on a pastel picked deterministically from the name. */
export function Avatar({ name, size = 32, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const color = COURSE_COLORS[(name.codePointAt(0) ?? 0) % COURSE_COLORS.length] ?? 'lime';
  return (
    <span
      title={name}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-bold text-ink',
        PASTEL_BG[color],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initial}
    </span>
  );
}

/** Overlapping avatars with a surface ring. */
export function AvatarStack({ children }: { children: ReactNode }) {
  return <div className="flex [&>*]:ring-2 [&>*]:ring-surface [&>*+*]:-ml-2">{children}</div>;
}
