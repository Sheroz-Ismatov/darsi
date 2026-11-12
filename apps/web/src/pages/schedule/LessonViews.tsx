import { addDays, utcToZoned, type LessonDto, type LessonStatus } from '@darsi/shared';
import { cn, DateBlock, PASTEL_BG, StatusBadge, Tag, type StatusTone } from '@darsi/ui';
import { useTranslation } from 'react-i18next';
import {
  formatDayLong,
  formatLessonMoment,
  formatLessonRange,
  formatLessonTime,
  formatWeekdayShort,
} from '../../lib/dates';

export const STATUS_TONE: Record<LessonStatus, StatusTone> = {
  planned: 'info',
  done: 'ok',
  cancelled: 'danger',
};

interface ViewProps {
  lessons: LessonDto[];
  timeZone: string;
  onOpen: (lesson: LessonDto) => void;
}

/** «Отменено» or «Перенесено с …»: the two states must read differently at a glance. */
function LessonMarks({ lesson, timeZone }: { lesson: LessonDto; timeZone: string }) {
  const { t } = useTranslation();
  if (lesson.status === 'cancelled') {
    return <Tag className="self-start px-2 py-0.5 text-[11px]">{t('calendar.cancelled')}</Tag>;
  }
  return (
    <>
      {lesson.originalStartsAt && (
        <span className="text-[11px] font-semibold text-warn">
          {t('calendar.movedFrom', {
            date: formatLessonMoment(lesson.originalStartsAt, timeZone),
          })}
        </span>
      )}
      {lesson.isOneOff && (
        <span className="text-[11px] font-semibold text-ink-2">{t('calendar.oneOffTag')}</span>
      )}
    </>
  );
}

function WeekCard({
  lesson,
  timeZone,
  onOpen,
}: { lesson: LessonDto } & Omit<ViewProps, 'lessons'>) {
  const { t } = useTranslation();
  const cancelled = lesson.status === 'cancelled';
  const range = formatLessonRange(lesson.startsAt, lesson.durationMin, timeZone);
  return (
    <button
      type="button"
      onClick={() => onOpen(lesson)}
      aria-label={t('calendar.lessonLabel', { range, group: lesson.groupName })}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[6px_1fr] overflow-hidden rounded-md border border-hairline text-left transition hover:border-ink',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
        cancelled ? 'border-dashed bg-surface-2 opacity-70' : 'bg-surface',
      )}
    >
      <span className={cn(PASTEL_BG[lesson.course.color], cancelled && 'opacity-40')} aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5 p-2.5">
        <span className={cn('font-mono text-xs font-semibold', cancelled && 'line-through')}>
          {range}
        </span>
        <span className="truncate text-[13px] font-bold">{lesson.groupName}</span>
        <span className="truncate text-xs text-muted">{lesson.course.name}</span>
        <span className="truncate text-xs text-muted">{lesson.teacher.displayName}</span>
        <LessonMarks lesson={lesson} timeZone={timeZone} />
      </span>
    </button>
  );
}

/** Seven columns Monday to Sunday; on a narrow screen they scroll sideways. */
export function WeekView({
  monday,
  today,
  lessons,
  timeZone,
  onOpen,
}: ViewProps & { monday: string; today: string }) {
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = new Map<string, LessonDto[]>(days.map((date) => [date, []]));
  for (const lesson of lessons) {
    byDay.get(utcToZoned(new Date(lesson.startsAt), timeZone).date)?.push(lesson);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[980px] grid-cols-7 gap-2">
        {days.map((date) => {
          const isToday = date === today;
          const items = byDay.get(date) ?? [];
          return (
            <section
              key={date}
              aria-label={formatDayLong(date)}
              aria-current={isToday ? 'date' : undefined}
              className={cn(
                'flex min-h-[220px] flex-col gap-2 rounded-lg border bg-surface p-2',
                isToday ? 'border-ink ring-1 ring-ink' : 'border-hairline',
              )}
            >
              <div className="flex items-center gap-2">
                <DateBlock day={Number(date.slice(8, 10))} caption={formatWeekdayShort(date)} />
                {isToday && (
                  <span className="font-mono text-[10px] font-semibold text-ink uppercase">
                    {t('calendar.todayMark')}
                  </span>
                )}
              </div>
              {items.length === 0 ? (
                <div className="px-1 text-xs text-muted">{t('calendar.noLessonsDay')}</div>
              ) : (
                items.map((lesson) => (
                  <WeekCard key={lesson.id} lesson={lesson} timeZone={timeZone} onOpen={onOpen} />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** One day as `LessonRow`s: grid `64px 1fr auto`, the border turns ink on hover. */
export function DayView({ lessons, timeZone, onOpen }: ViewProps) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {lessons.map((lesson) => {
        const cancelled = lesson.status === 'cancelled';
        const end = new Date(Date.parse(lesson.startsAt) + lesson.durationMin * 60_000);
        return (
          <li key={lesson.id}>
            <button
              type="button"
              onClick={() => onOpen(lesson)}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[64px_1fr_auto] items-center gap-4 rounded-lg border border-hairline p-3.5 text-left transition hover:border-ink',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                cancelled ? 'border-dashed bg-surface-2 opacity-70' : 'bg-surface',
              )}
            >
              <span
                className={cn(
                  'rounded-sm py-2 text-center',
                  PASTEL_BG[lesson.course.color],
                  cancelled && 'opacity-50',
                )}
              >
                <span className={cn('block text-[15px] font-bold', cancelled && 'line-through')}>
                  {formatLessonTime(lesson.startsAt, timeZone)}
                </span>
                <span className="block font-mono text-[10px] text-ink/70">
                  {formatLessonTime(end.toISOString(), timeZone)}
                </span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-bold">
                  {lesson.course.name} · {lesson.groupName}
                </span>
                <span className="truncate text-[13px] text-muted">
                  {lesson.teacher.displayName}
                </span>
                <LessonMarks lesson={lesson} timeZone={timeZone} />
              </span>
              <StatusBadge tone={STATUS_TONE[lesson.status]}>
                {t(`schedule.status.${lesson.status}`)}
              </StatusBadge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
