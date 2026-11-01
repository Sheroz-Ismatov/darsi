import { Eyebrow } from '@darsi/ui';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
}

/** Eyebrow + display H1 on the left, page actions on the right (prototype THome). */
export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="m-0 text-[56px] leading-[1.02] font-bold tracking-[-0.035em] text-balance max-[800px]:text-[38px]">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
