import { addDays, LESSONS_RANGE_MAX_DAYS, todayIn, weekdayOf } from '@darsi/shared';
import { Button, cn, EmptyState, Segmented, Select } from '@darsi/ui';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { SECTION_PATH } from '../../app/auth/access';
import { PageHeader } from '../../app/layout/PageHeader';
import { useSchool } from '../../app/school';
import { useCourses, useTeachers } from '../../features/courses/courses-api';
import { useLessons } from '../../features/lessons/schedule-api';
import { formatDayLong, formatPeriod } from '../../lib/dates';
import { errorText } from '../../lib/error-text';
import { LessonDrawer } from './LessonDrawer';
import { DayView, WeekView } from './LessonViews';
import { OneOffLessonDialog, type GroupOption } from './OneOffLessonDialog';

type View = 'week' | 'day';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The calendar state lives in the address (`?view=week&date=…&teacher=…`), so a copied link
 * opens the same view.
 */
function useCalendarParams(today: string) {
  const [params, setParams] = useSearchParams();
  const rawDate = params.get('date') ?? '';
  const state = {
    view: (params.get('view') === 'day' ? 'day' : 'week') as View,
    date: DATE_RE.test(rawDate) ? rawDate : today,
    teacher: params.get('teacher') ?? '',
    course: params.get('course') ?? '',
    group: params.get('group') ?? '',
  };
  const update = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(next)) if (value) search.set(name, value);
    setParams(search, { replace: true });
  };
  return [state, update] as const;
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
      {label}
      <Select
        className="py-2.5"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t('calendar.all')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Calendar({ timeZone }: { timeZone: string }) {
  const { t } = useTranslation();
  const today = todayIn(timeZone, new Date());
  const [state, update] = useCalendarParams(today);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const teachers = useTeachers();
  const courses = useCourses(false);

  const from = state.view === 'week' ? addDays(state.date, 1 - weekdayOf(state.date)) : state.date;
  const to = state.view === 'week' ? addDays(from, 6) : from;
  const step = state.view === 'week' ? 7 : 1;
  const lessons = useLessons({
    from,
    to,
    teacherId: state.teacher,
    courseId: state.course,
    groupId: state.group,
  });
  const filtered = Boolean(state.teacher || state.course || state.group);
  const empty = lessons.isSuccess && !lessons.isPlaceholderData && lessons.data.length === 0;
  // Only asked when the period is empty: tells "nothing this week" from "no schedule at all".
  const ahead = useLessons(
    { from: today, to: addDays(today, LESSONS_RANGE_MAX_DAYS - 1) },
    { enabled: empty && !filtered },
  );
  const noSchedule = empty && !filtered && ahead.isSuccess && ahead.data.length === 0;

  const { groupOptions, activeGroups } = useMemo(() => {
    const all = courses.data ?? [];
    const pick = state.course ? all.filter((course) => course.id === state.course) : all;
    return {
      groupOptions: pick.flatMap((course) =>
        course.groups.map((group) => ({ id: group.id, label: group.name })),
      ),
      activeGroups: all.flatMap((course) =>
        course.groups
          .filter((group) => !group.archived)
          .map((group): GroupOption => ({ id: group.id, label: `${course.name} · ${group.name}` })),
      ),
    };
  }, [courses.data, state.course]);

  const navLabels =
    state.view === 'week'
      ? { prev: t('calendar.prevWeek'), next: t('calendar.nextWeek') }
      : { prev: t('calendar.prevDay'), next: t('calendar.nextDay') };

  return (
    <>
      <PageHeader
        eyebrow={t('calendar.eyebrow')}
        title={state.view === 'week' ? formatPeriod(from, to) : formatDayLong(from)}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden />
            {t('calendar.oneOff')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={navLabels.prev}
            onClick={() => update({ date: addDays(state.date, -step) })}
          >
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={navLabels.next}
            onClick={() => update({ date: addDays(state.date, step) })}
          >
            <ChevronRight size={18} aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update({ date: today })}>
            {t('calendar.today')}
          </Button>
        </div>
        <Segmented
          className="w-[220px]"
          label={t('calendar.viewLabel')}
          value={state.view}
          onChange={(view) => update({ view })}
          options={[
            { value: 'week', label: t('calendar.week') },
            { value: 'day', label: t('calendar.day') },
          ]}
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <Filter
          label={t('calendar.filterTeacher')}
          value={state.teacher}
          onChange={(teacher) => update({ teacher })}
          options={(teachers.data ?? []).map((m) => ({ id: m.id, label: m.displayName }))}
        />
        <Filter
          label={t('calendar.filterCourse')}
          value={state.course}
          // A group of another course would leave the calendar empty for no visible reason.
          onChange={(course) => update({ course, group: '' })}
          options={(courses.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
        />
        <Filter
          label={t('calendar.filterGroup')}
          value={state.group}
          onChange={(group) => update({ group })}
          options={groupOptions}
        />
      </div>

      {/* The previous period stays on screen while the next one loads: dimmed and marked busy. */}
      <div
        aria-busy={lessons.isPlaceholderData}
        className={cn(lessons.isPlaceholderData && 'opacity-50')}
      >
        {lessons.isPlaceholderData && (
          <div className="mb-2 text-[13px] text-muted">{t('common.loading')}</div>
        )}
        {lessons.isPending ? (
          <div className="text-muted">{t('common.loading')}</div>
        ) : lessons.isError ? (
          <div role="alert" className="text-[13px] font-semibold text-danger">
            {errorText(lessons.error)}
          </div>
        ) : noSchedule ? (
          <EmptyState
            title={t('calendar.noSchedule')}
            text={t('calendar.noScheduleText')}
            action={
              <Link
                to={SECTION_PATH.courses}
                className="text-sm font-semibold underline decoration-lime decoration-[3px] underline-offset-4"
              >
                {t('calendar.toCourses')}
              </Link>
            }
          />
        ) : state.view === 'week' ? (
          <WeekView
            monday={from}
            today={today}
            lessons={lessons.data}
            timeZone={timeZone}
            onOpen={(lesson) => setOpenLessonId(lesson.id)}
          />
        ) : empty ? (
          <EmptyState title={t('calendar.empty')} text={t('calendar.emptyText')} />
        ) : (
          <DayView
            lessons={lessons.data}
            timeZone={timeZone}
            onOpen={(lesson) => setOpenLessonId(lesson.id)}
          />
        )}

        {state.view === 'week' && empty && !noSchedule && (
          <EmptyState className="mt-4" title={t('calendar.empty')} text={t('calendar.emptyText')} />
        )}
      </div>

      {openLessonId && (
        <LessonDrawer
          lessonId={openLessonId}
          timeZone={timeZone}
          onClose={() => setOpenLessonId(null)}
        />
      )}
      {creating && (
        <OneOffLessonDialog
          groups={activeGroups}
          initialDate={from <= today && today <= to ? today : from}
          initialGroupId={state.group || undefined}
          timeZone={timeZone}
          onClose={() => setCreating(false)}
          onCreated={(date) => update({ date })}
        />
      )}
    </>
  );
}

/** W-3: the school's lessons as a week or a day, with filters (TZ FR-15, FR-16). */
export function SchedulePage() {
  const { t } = useTranslation();
  const school = useSchool();
  if (school.isPending) return <div className="text-muted">{t('common.loading')}</div>;
  if (school.isError) {
    return (
      <div role="alert" className="text-[13px] font-semibold text-danger">
        {errorText(school.error)}
      </div>
    );
  }
  return <Calendar timeZone={school.data.timezone} />;
}
