import {
  addDays,
  LESSONS_RANGE_MAX_DAYS,
  putScheduleRulesRequestSchema,
  SCHEDULE_RULES_MAX,
  todayIn,
  type GroupDto,
  type LessonStatus,
  type PutScheduleRulesResponse,
  type ScheduleRuleDto,
} from '@darsi/shared';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Eyebrow,
  Input,
  Select,
  StatusBadge,
  type StatusTone,
} from '@darsi/ui';
import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/school';
import { formatLessonDay, formatLessonRange } from '../../lib/dates';
import { errorText } from '../../lib/error-text';
import { ConflictsNote } from './ConflictsNote';
import { normalizeTime, timeChars } from './lesson-time';
import { useLessons, useSaveScheduleRules, useScheduleRules } from './schedule-api';

/** ISO weekday numbers with their dictionary keys. */
const WEEKDAYS = [
  [1, 'mon'],
  [2, 'tue'],
  [3, 'wed'],
  [4, 'thu'],
  [5, 'fri'],
  [6, 'sat'],
  [7, 'sun'],
] as const;
const DURATIONS = ['30', '45', '60', '90', '120'] as const;
const CUSTOM = 'custom';
const UPCOMING_COUNT = 10;

const STATUS_TONE: Record<LessonStatus, StatusTone> = {
  planned: 'info',
  done: 'ok',
  cancelled: 'danger',
};

interface Row {
  key: number;
  weekday: number | null;
  startTime: string;
  /** One of DURATIONS or CUSTOM. */
  duration: string;
  customDuration: string;
}

type RowError = 'weekday' | 'startTime' | 'duplicate' | 'durationMin';

let nextKey = 0;

const toRow = (rule?: ScheduleRuleDto): Row => {
  const preset = rule && (DURATIONS as readonly string[]).includes(String(rule.durationMin));
  return {
    key: nextKey++,
    weekday: rule?.weekday ?? null,
    startTime: rule?.startTime ?? '15:00',
    duration: rule ? (preset ? String(rule.durationMin) : CUSTOM) : '60',
    customDuration: rule && !preset ? String(rule.durationMin) : '',
  };
};

const toRequest = (rows: Row[]) => ({
  rules: rows.map((row) => ({
    weekday: row.weekday ?? 0,
    startTime: normalizeTime(row.startTime),
    durationMin: Number(row.duration === CUSTOM ? row.customDuration : row.duration),
  })),
});

function RulesEditor({
  group,
  initial,
  onSaved,
}: {
  group: GroupDto;
  initial: ScheduleRuleDto[];
  onSaved: (result: PutScheduleRulesResponse) => void;
}) {
  const { t } = useTranslation();
  const save = useSaveScheduleRules(group.id);
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [errors, setErrors] = useState<ReadonlyMap<number, RowError>>(new Map());

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = putScheduleRulesRequestSchema.safeParse(toRequest(rows));
    if (!parsed.success) {
      const found = new Map<number, RowError>();
      for (const issue of parsed.error.issues) {
        const [, index, field] = issue.path;
        const row = typeof index === 'number' ? rows[index] : undefined;
        if (!row || found.has(row.key)) continue;
        if (field === 'weekday') found.set(row.key, 'weekday');
        else if (field === 'durationMin') found.set(row.key, 'durationMin');
        else found.set(row.key, issue.code === 'custom' ? 'duplicate' : 'startTime');
      }
      setErrors(found);
      return;
    }
    setErrors(new Map());
    save.mutate(parsed.data, {
      onSuccess: (result) => {
        setRows(result.rules.map(toRow));
        onSaved(result);
      },
    });
  };

  const ERROR_TEXT: Record<RowError, string> = {
    weekday: t('schedule.errorWeekday'),
    startTime: t('schedule.errorTime'),
    duplicate: t('schedule.errorDuplicate'),
    durationMin: t('schedule.errorDuration'),
  };

  return (
    <form onSubmit={submit} noValidate>
      {rows.length === 0 && <div className="mb-4 text-sm text-muted">{t('schedule.noRules')}</div>}
      <ul className="m-0 mb-4 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => {
          const error = errors.get(row.key);
          return (
            <li
              key={row.key}
              className="rounded-md border border-hairline p-4"
              aria-label={t('schedule.rowLabel', { n: index + 1 })}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={t('schedule.fieldWeekday')}
                >
                  {WEEKDAYS.map(([weekday, name]) => (
                    <Chip
                      key={weekday}
                      active={row.weekday === weekday}
                      className="px-3 py-2"
                      onClick={() => update(row.key, { weekday })}
                    >
                      {t(`schedule.weekdays.${name}`)}
                    </Chip>
                  ))}
                </div>
                {/* Plain text field: <input type="time"> follows the OS locale and may show AM/PM. */}
                <div className="w-[100px]">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="15:00"
                    aria-label={t('schedule.fieldTime')}
                    className="py-2.5 font-mono"
                    value={row.startTime}
                    aria-invalid={error === 'startTime' || error === 'duplicate'}
                    onChange={(event) =>
                      update(row.key, { startTime: timeChars(event.target.value) })
                    }
                    onBlur={() => update(row.key, { startTime: normalizeTime(row.startTime) })}
                  />
                </div>
                <div className="w-[150px]">
                  <Select
                    aria-label={t('schedule.fieldDuration')}
                    className="py-2.5"
                    value={row.duration}
                    onChange={(event) => update(row.key, { duration: event.target.value })}
                  >
                    {DURATIONS.map((value) => (
                      <option key={value} value={value}>
                        {t('schedule.minutes', { n: value })}
                      </option>
                    ))}
                    <option value={CUSTOM}>{t('schedule.customDuration')}</option>
                  </Select>
                </div>
                {row.duration === CUSTOM && (
                  <div className="w-[110px]">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={15}
                      max={480}
                      aria-label={t('schedule.fieldCustomDuration')}
                      placeholder={t('schedule.minutesPlaceholder')}
                      className="py-2.5"
                      value={row.customDuration}
                      aria-invalid={error === 'durationMin'}
                      onChange={(event) => update(row.key, { customDuration: event.target.value })}
                    />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  aria-label={t('schedule.removeRow')}
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  <X size={16} aria-hidden />
                </Button>
              </div>
              {error && (
                <div role="alert" className="mt-2 text-xs font-semibold text-danger">
                  {ERROR_TEXT[error]}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          disabled={rows.length >= SCHEDULE_RULES_MAX}
          onClick={() => setRows((current) => [...current, toRow()])}
        >
          <Plus size={16} aria-hidden />
          {t('schedule.addRow')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {t('schedule.save')}
        </Button>
      </div>

      {save.isError && (
        <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {errorText(save.error)}
        </div>
      )}
    </form>
  );
}

function UpcomingLessons({ groupId, timeZone }: { groupId: string; timeZone: string }) {
  const { t } = useTranslation();
  const from = todayIn(timeZone, new Date());
  const lessons = useLessons({ from, to: addDays(from, LESSONS_RANGE_MAX_DAYS - 1), groupId });

  if (lessons.isPending) return <div className="text-muted">{t('common.loading')}</div>;
  if (lessons.isError) {
    return (
      <div role="alert" className="text-[13px] font-semibold text-danger">
        {errorText(lessons.error)}
      </div>
    );
  }
  const now = Date.now();
  const upcoming = lessons.data
    .filter((lesson) => Date.parse(lesson.startsAt) + lesson.durationMin * 60_000 > now)
    .slice(0, UPCOMING_COUNT);
  if (upcoming.length === 0) {
    return <EmptyState title={t('schedule.lessonsEmpty')} text={t('schedule.lessonsEmptyText')} />;
  }
  return (
    <ul className="m-0 list-none divide-y divide-hairline p-0">
      {upcoming.map((lesson) => (
        <li key={lesson.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <span className="w-[150px] font-semibold">
            {formatLessonDay(lesson.startsAt, timeZone)}
          </span>
          <span className="font-mono text-sm">
            {formatLessonRange(lesson.startsAt, lesson.durationMin, timeZone)}
          </span>
          <StatusBadge tone={STATUS_TONE[lesson.status]} className="ml-auto">
            {t(`schedule.status.${lesson.status}`)}
          </StatusBadge>
        </li>
      ))}
    </ul>
  );
}

/** W-5 «Расписание» tab: weekly rules of the group and its next lessons (TZ FR-13, FR-14). */
export function ScheduleTab({ group }: { group: GroupDto }) {
  const { t } = useTranslation();
  const school = useSchool();
  const rules = useScheduleRules(group.id);
  const [result, setResult] = useState<PutScheduleRulesResponse | null>(null);

  if (school.isPending || rules.isPending) {
    return <div className="text-muted">{t('common.loading')}</div>;
  }
  if (school.isError || rules.isError) {
    return (
      <div role="alert" className="text-[13px] font-semibold text-danger">
        {errorText(school.error ?? rules.error)}
      </div>
    );
  }
  const { timezone } = school.data;
  const inactive = group.archived || group.course.archived;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Eyebrow>{t('schedule.rulesTitle')}</Eyebrow>
        <p className="mt-0 mb-4 text-sm text-ink-2">
          {t('schedule.rulesText', { zone: timezone })}
        </p>
        {inactive && (
          <div className="mb-4 text-sm font-semibold text-warn">{t('schedule.inactive')}</div>
        )}
        <RulesEditor group={group} initial={rules.data} onSaved={setResult} />
        {result && (
          <div role="status" className="mt-4 text-sm font-semibold">
            {t('schedule.saved', { created: result.created, deleted: result.deleted })}
          </div>
        )}
        {result && result.conflicts.length > 0 && (
          <ConflictsNote
            title={t('schedule.conflictsTitle')}
            items={result.conflicts}
            timeZone={timezone}
          />
        )}
      </Card>
      <Card>
        <Eyebrow>{t('schedule.upcomingTitle')}</Eyebrow>
        <UpcomingLessons groupId={group.id} timeZone={timezone} />
      </Card>
    </div>
  );
}
