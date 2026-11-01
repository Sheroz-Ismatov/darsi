import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, text, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'pattern-hatch flex flex-col items-center gap-2 rounded-md px-6 py-10 text-center',
        className,
      )}
    >
      <div className="font-bold">{title}</div>
      {text && <div className="max-w-sm text-[13px] text-muted">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
