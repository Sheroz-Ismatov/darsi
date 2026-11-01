import { cn } from '../cn';

export interface DateBlockProps {
  /** Day of month. */
  day: number;
  /** Pre-formatted short caption from i18n (weekday or month): «чт», «мая». */
  caption: string;
  className?: string;
}

export function DateBlock({ day, caption, className }: DateBlockProps) {
  return (
    <div className={cn('w-14 shrink-0 rounded-sm bg-bg py-2 text-center', className)}>
      <div className="text-lg leading-none font-bold">{day}</div>
      <div className="mt-1 font-mono text-[10px] text-muted uppercase">{caption}</div>
    </div>
  );
}
