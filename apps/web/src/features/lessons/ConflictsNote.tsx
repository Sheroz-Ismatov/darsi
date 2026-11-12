import type { LessonConflictDto } from '@darsi/shared';
import { TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatLessonDay, formatLessonRange, formatLessonTime } from '../../lib/dates';

/** Overlaps of a teacher's lessons (TZ FR-14): a warning, the change is already saved. */
export function ConflictsNote({
  title,
  items,
  timeZone,
}: {
  title: string;
  items: LessonConflictDto[];
  timeZone: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" className="mt-4 rounded-md bg-warn-bg p-4 text-warn">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <TriangleAlert size={16} aria-hidden />
        {title}
      </div>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={`${item.startsAt}|${item.otherStartsAt}`}>
            {t('schedule.conflictLine', {
              day: formatLessonDay(item.startsAt, timeZone),
              time: formatLessonTime(item.startsAt, timeZone),
              group: item.otherGroupName,
              range: formatLessonRange(item.otherStartsAt, item.otherDurationMin, timeZone),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
