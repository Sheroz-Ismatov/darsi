import type { ReactNode } from 'react';

/** Full-screen message with the Darsi mark: progress, result or error of a launch action. */
export function StatusScreen({
  title,
  text,
  children,
}: {
  title: ReactNode;
  text?: ReactNode;
  /** Details and action buttons under the text. */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-[16px] bg-ink font-mono text-xl font-bold text-lime">
        D
      </div>
      <h1 className="m-0 text-[28px] leading-tight font-bold tracking-[-0.03em]">{title}</h1>
      {text && <p className="m-0 max-w-xs text-muted">{text}</p>}
      {children && <div className="flex w-full max-w-xs flex-col gap-3">{children}</div>}
    </div>
  );
}
