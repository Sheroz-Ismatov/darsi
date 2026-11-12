import {
  createLessonRequestSchema,
  LESSON_DURATION_MAX,
  LESSON_DURATION_MIN,
  type LessonConflictDto,
} from '@darsi/shared';
import { Button, Dialog, Field, Input, Select } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeachers } from '../../features/courses/courses-api';
import { ConflictsNote } from '../../features/lessons/ConflictsNote';
import { normalizeTime, timeChars } from '../../features/lessons/lesson-time';
import { useCreateLesson } from '../../features/lessons/schedule-api';
import { errorText } from '../../lib/error-text';

const FORM_ID = 'one-off-lesson-form';

export interface GroupOption {
  id: string;
  label: string;
}

const FIELD_ERROR = {
  groupId: 'calendar.errorGroup',
  date: 'calendar.errorDate',
  time: 'schedule.errorTime',
  durationMin: 'schedule.errorDuration',
} as const;
type ErrorField = keyof typeof FIELD_ERROR;

/** W-3 «Разовое занятие»: a lesson outside the weekly rules (TZ FR-15). */
export function OneOffLessonDialog({
  groups,
  initialDate,
  initialGroupId,
  timeZone,
  onClose,
  onCreated,
}: {
  /** Active groups only: an archived group takes no lessons. */
  groups: GroupOption[];
  initialDate: string;
  initialGroupId?: string;
  timeZone: string;
  onClose: () => void;
  /** Called with the lesson's date in the school's zone, to show it in the calendar. */
  onCreated: (date: string) => void;
}) {
  const { t } = useTranslation();
  const teachers = useTeachers();
  const create = useCreateLesson();
  const [groupId, setGroupId] = useState(initialGroupId ?? '');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('15:00');
  const [duration, setDuration] = useState('60');
  const [teacherId, setTeacherId] = useState('');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const [conflicts, setConflicts] = useState<LessonConflictDto[] | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createLessonRequestSchema.safeParse({
      groupId,
      date,
      time: normalizeTime(time),
      durationMin: Number(duration),
      ...(teacherId && { teacherMembershipId: teacherId }),
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    create.mutate(parsed.data, {
      onSuccess: (result) => {
        onCreated(parsed.data.date);
        // With overlaps the dialog stays open to show them; otherwise it is done.
        if (result.conflicts.length > 0) setConflicts(result.conflicts);
        else onClose();
      },
    });
  };

  const error = (field: ErrorField) => (invalid.has(field) ? t(FIELD_ERROR[field]) : null);

  if (conflicts) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={t('calendar.oneOffTitle')}
        closeLabel={t('calendar.close')}
        footer={<Button onClick={onClose}>{t('calendar.done')}</Button>}
      >
        <div role="status" className="text-sm font-semibold text-ok">
          {t('calendar.created')}
        </div>
        <ConflictsNote title={t('calendar.conflictsTitle')} items={conflicts} timeZone={timeZone} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('calendar.oneOffTitle')}
      closeLabel={t('calendar.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={create.isPending || groups.length === 0}>
            {t('calendar.create')}
          </Button>
        </>
      }
    >
      <p className="mt-0 mb-4 text-sm text-ink-2">{t('calendar.oneOffText', { zone: timeZone })}</p>
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field label={t('calendar.fieldGroup')} htmlFor="one-off-group" error={error('groupId')}>
          {groups.length === 0 ? (
            <div className="rounded-md border border-dashed border-hairline px-4 py-3.5 text-[13px]">
              {t('calendar.noGroups')}
            </div>
          ) : (
            <Select
              id="one-off-group"
              value={groupId}
              aria-invalid={invalid.has('groupId')}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">{t('calendar.chooseGroup')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-[1fr_110px_130px] gap-3 max-[560px]:grid-cols-1">
          <Field label={t('calendar.fieldDate')} htmlFor="one-off-date" error={error('date')}>
            <Input
              id="one-off-date"
              type="date"
              value={date}
              aria-invalid={invalid.has('date')}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label={t('calendar.fieldTime')} htmlFor="one-off-time" error={error('time')}>
            {/* Plain text field: <input type="time"> follows the OS locale and may show AM/PM. */}
            <Input
              id="one-off-time"
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="15:00"
              className="font-mono"
              value={time}
              aria-invalid={invalid.has('time')}
              onChange={(event) => setTime(timeChars(event.target.value))}
              onBlur={() => setTime(normalizeTime(time))}
            />
          </Field>
          <Field
            label={t('calendar.fieldDuration')}
            htmlFor="one-off-duration"
            error={error('durationMin')}
          >
            <Input
              id="one-off-duration"
              type="number"
              inputMode="numeric"
              min={LESSON_DURATION_MIN}
              max={LESSON_DURATION_MAX}
              value={duration}
              aria-invalid={invalid.has('durationMin')}
              onChange={(event) => setDuration(event.target.value)}
            />
          </Field>
        </div>
        <Field label={t('calendar.teacher')} htmlFor="one-off-teacher">
          <Select
            id="one-off-teacher"
            value={teacherId}
            disabled={teachers.isPending}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            <option value="">{t('calendar.groupTeacher')}</option>
            {(teachers.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.status === 'invited'
                  ? t('groups.teacherInvited', { name: member.displayName })
                  : member.displayName}
              </option>
            ))}
          </Select>
        </Field>
        {create.isError && (
          <div role="alert" className="text-[13px] font-semibold text-danger">
            {errorText(create.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
