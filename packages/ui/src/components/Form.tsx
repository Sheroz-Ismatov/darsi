import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../cn';

const CONTROL =
  'w-full appearance-none rounded-md border border-hairline bg-surface px-4 py-3.5 text-ink outline-none transition ' +
  'placeholder:text-muted focus:border-ink focus:ring-4 focus:ring-focus ' +
  'aria-[invalid=true]:border-danger disabled:opacity-60';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(CONTROL, 'cursor-pointer pr-10', className)} {...props} />;
}

export interface FieldProps {
  label: ReactNode;
  /** id of the control inside, to link the label. */
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <div role="alert" className="text-xs font-semibold text-danger">
          {error}
        </div>
      ) : (
        hint && <div className="text-xs text-muted">{hint}</div>
      )}
    </div>
  );
}
