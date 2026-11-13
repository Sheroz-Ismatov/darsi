import {
  cancelLessonRequestSchema,
  LESSON_CANCEL_REASON_MAX,
  LESSON_DURATION_MAX,
  LESSON_DURATION_MIN,
  rescheduleLessonRequestSchema,
  updateLessonRequestSchema,
  utcToZoned,
  type LessonConflictDto,
  type LessonDetailDto,
} from '@darsi/shared';
import {
  Button,
  Drawer,
  EmptyState,
  Eyebrow,
  Field,
  Input,
  Select,
  StatusBadge,
  Tag,
  Textarea,
} from '@darsi/ui';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useTeachers } from '../../features/courses/courses-api';
import { ConflictsNote } from '../../features/lessons/ConflictsNote';
import { normalizeTime, timeChars } from '../../features/lessons/lesson-time';
import {
  useCancelLesson,
  useLesson,
  useRescheduleLesson,
  useRestoreLesson,
  useUpdateLesson,
} from '../../features/lessons/schedule-api';
import { formatLessonDay, formatLessonMoment, formatLessonRange } from '../../lib/dates';
import { errorText } from '../../lib/error-text';
import { STATUS_TONE } from './LessonViews';

type Mode = 'view' | 'reschedule' | 'cancel' | 'teacher' | 'link';

interface Notice {
  text: string;
  conflicts: LessonConflictDto[];
}

interface FormProps {
  lesson: LessonDetailDto;
  timeZone: string;
  onDone: (notice: Notice) => void;
  onBack: () => void;
}

function FormActions({
  submitLabel,
  pending,
  onBack,
}: {
  submitLabel: string;
  pending: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Button variant="ghost" size="sm" onClick={onBack}>
        {t('calendar.back')}
      </Button>
      <Button type="submit" size="sm" disabled={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[13px] text-muted">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

function FormError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="mt-2 text-[13px] font-semibold text-danger">
      {errorText(error)}
    </div>
  );
}

function RescheduleForm({ lesson, timeZone, onDone, onBack }: FormProps) {
  const { t } = useTranslation();
  const reschedule = useRescheduleLesson(lesson.id);
  const start = utcToZoned(new Date(lesson.startsAt), timeZone);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [duration, setDuration] = useState(String(lesson.durationMin));
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = rescheduleLessonRequestSchema.safeParse({
      date,
      time: normalizeTime(time),
      durationMin: Number(duration),
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    reschedule.mutate(parsed.data, {
      onSuccess: (result) =>
        onDone({ text: t('calendar.savedReschedule'), conflicts: result.conflicts }),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="mt-0 mb-4 text-[13px] text-muted">
        {t('calendar.rescheduleHint', { zone: timeZone })}
      </p>
      <Field
        label={t('calendar.fieldDate')}
        htmlFor="lesson-date"
        error={invalid.has('date') ? t('calendar.errorDate') : null}
      >
        <Input
          id="lesson-date"
          type="date"
          value={date}
          aria-invalid={invalid.has('date')}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>
      <Field
        label={t('calendar.fieldTime')}
        htmlFor="lesson-time"
        error={invalid.has('time') ? t('schedule.errorTime') : null}
      >
        {/* Plain text field: <input type="time"> follows the OS locale and may show AM/PM. */}
        <Input
          id="lesson-time"
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
        htmlFor="lesson-duration"
        error={invalid.has('durationMin') ? t('schedule.errorDuration') : null}
      >
        <Input
          id="lesson-duration"
          type="number"
          inputMode="numeric"
          min={LESSON_DURATION_MIN}
          max={LESSON_DURATION_MAX}
          value={duration}
          aria-invalid={invalid.has('durationMin')}
          onChange={(event) => setDuration(event.target.value)}
        />
      </Field>
      {reschedule.isError && <FormError error={reschedule.error} />}
      <FormActions
        submitLabel={t('calendar.reschedule')}
        pending={reschedule.isPending}
        onBack={onBack}
      />
    </form>
  );
}

function CancelForm({ lesson, onDone, onBack }: FormProps) {
  const { t } = useTranslation();
  const cancel = useCancelLesson(lesson.id);
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = cancelLessonRequestSchema.safeParse({ reason });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    cancel.mutate(parsed.data, {
      onSuccess: () => onDone({ text: t('calendar.savedCancel'), conflicts: [] }),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field
        label={t('calendar.fieldReason')}
        htmlFor="lesson-reason"
        hint={t('calendar.reasonHint')}
        error={invalid ? t('calendar.errorReason') : null}
      >
        <Textarea
          id="lesson-reason"
          rows={3}
          maxLength={LESSON_CANCEL_REASON_MAX}
          value={reason}
          aria-invalid={invalid}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="text-[13px] font-semibold text-warn">{t('calendar.cancelWarning')}</div>
      {cancel.isError && <FormError error={cancel.error} />}
      <FormActions
        submitLabel={t('calendar.confirmCancel')}
        pending={cancel.isPending}
        onBack={onBack}
      />
    </form>
  );
}

function TeacherForm({ lesson, onDone, onBack }: FormProps) {
  const { t } = useTranslation();
  const teachers = useTeachers();
  const update = useUpdateLesson(lesson.id);
  const [teacherId, setTeacherId] = useState('');
  const [invalid, setInvalid] = useState(false);
  const options = (teachers.data ?? []).filter((member) => member.id !== lesson.teacher.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateLessonRequestSchema.safeParse({ teacherMembershipId: teacherId });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    update.mutate(parsed.data, {
      onSuccess: (result) =>
        onDone({ text: t('calendar.savedTeacher'), conflicts: result.conflicts }),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field
        label={t('calendar.fieldTeacher')}
        htmlFor="lesson-teacher"
        error={invalid ? t('calendar.errorTeacher') : null}
      >
        <Select
          id="lesson-teacher"
          value={teacherId}
          disabled={teachers.isPending}
          aria-invalid={invalid}
          onChange={(event) => setTeacherId(event.target.value)}
        >
          <option value="">{t('groups.chooseTeacher')}</option>
          {options.map((member) => (
            <option key={member.id} value={member.id}>
              {member.status === 'invited'
                ? t('groups.teacherInvited', { name: member.displayName })
                : member.displayName}
            </option>
          ))}
        </Select>
      </Field>
      {teachers.isSuccess && options.length === 0 && (
        <div className="text-[13px] text-muted">{t('calendar.noOtherTeachers')}</div>
      )}
      {update.isError && <FormError error={update.error} />}
      <FormActions submitLabel={t('calendar.save')} pending={update.isPending} onBack={onBack} />
    </form>
  );
}

function LinkForm({ lesson, onDone, onBack }: FormProps) {
  const { t } = useTranslation();
  const update = useUpdateLesson(lesson.id);
  const [url, setUrl] = useState(lesson.meetingUrl ?? '');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateLessonRequestSchema.safeParse({ meetingUrl: url });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    update.mutate(parsed.data, {
      onSuccess: () => onDone({ text: t('calendar.savedLink'), conflicts: [] }),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field
        label={t('calendar.meeting')}
        htmlFor="lesson-url"
        hint={t('calendar.linkHint')}
        error={invalid ? t('groups.errorMeetingUrl') : null}
      >
        <Input
          id="lesson-url"
          type="url"
          maxLength={500}
          placeholder="https://"
          value={url}
          aria-invalid={invalid}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
      {update.isError && <FormError error={update.error} />}
      <FormActions submitLabel={t('calendar.save')} pending={update.isPending} onBack={onBack} />
    </form>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {t(copied ? 'calendar.copied' : 'calendar.copy')}
    </Button>
  );
}

function LessonDetails({
  lesson,
  timeZone,
  onEditLink,
}: {
  lesson: LessonDetailDto;
  timeZone: string;
  onEditLink: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={STATUS_TONE[lesson.status]}>
          {t(`schedule.status.${lesson.status}`)}
        </StatusBadge>
        {lesson.isOneOff && <Tag>{t('calendar.oneOffTag')}</Tag>}
      </div>
      <Row label={t('calendar.when')}>
        {formatLessonDay(lesson.startsAt, timeZone)} ·{' '}
        <span className="font-mono">
          {formatLessonRange(lesson.startsAt, lesson.durationMin, timeZone)}
        </span>
        {lesson.originalStartsAt && (
          <div className="mt-1 text-[13px] font-semibold text-warn">
            {t('calendar.movedFrom', {
              date: formatLessonMoment(lesson.originalStartsAt, timeZone),
            })}
          </div>
        )}
      </Row>
      {lesson.cancelReason && <Row label={t('calendar.cancelReason')}>{lesson.cancelReason}</Row>}
      <Row label={t('calendar.teacher')}>{lesson.teacher.displayName}</Row>
      <Row label={t('calendar.seats')}>
        {t('calendar.seatsValue', {
          used: lesson.group.enrolledCount,
          max: lesson.group.capacity,
        })}
      </Row>
      <div>
        <div className="text-[13px] text-muted">{t('calendar.meeting')}</div>
        {lesson.meetingUrl ? (
          <a
            href={lesson.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm break-all"
          >
            {lesson.meetingUrl}
          </a>
        ) : (
          <div className="text-sm text-muted">{t('calendar.noMeeting')}</div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {lesson.meetingUrl && <CopyButton value={lesson.meetingUrl} />}
          <Button variant="ghost" size="sm" onClick={onEditLink}>
            {t('calendar.changeLink')}
          </Button>
        </div>
      </div>
      <Link
        to={`/groups/${lesson.groupId}`}
        className="self-start text-sm font-semibold underline decoration-lime decoration-[3px] underline-offset-4"
      >
        {t('calendar.openGroup')}
      </Link>
      <div>
        <Eyebrow>{t('calendar.attendance')}</Eyebrow>
        {/* TODO(T-22): attendance marks of the lesson. */}
        <EmptyState className="py-6" title={t('calendar.attendanceSoon')} />
      </div>
      <div>
        <Eyebrow>{t('calendar.homework')}</Eyebrow>
        {/* TODO(T-34): homework of the lesson. */}
        <EmptyState className="py-6" title={t('calendar.homeworkSoon')} />
      </div>
    </div>
  );
}

const FORMS = {
  reschedule: RescheduleForm,
  cancel: CancelForm,
  teacher: TeacherForm,
  link: LinkForm,
} as const;

/** W-3 lesson card: details, and moving, cancelling or re-staffing a planned lesson (FR-15). */
export function LessonDrawer({
  lessonId,
  timeZone,
  onClose,
}: {
  lessonId: string;
  timeZone: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const query = useLesson(lessonId);
  const restore = useRestoreLesson(lessonId);
  const [mode, setMode] = useState<Mode>('view');
  const [notice, setNotice] = useState<Notice | null>(null);
  const lesson = query.data;
  const planned = lesson?.status === 'planned';

  const open = (next: Mode) => {
    setNotice(null);
    restore.reset();
    setMode(next);
  };

  const bringBack = () => {
    setNotice(null);
    restore.mutate(undefined, {
      onSuccess: (result) =>
        setNotice({ text: t('calendar.savedRestore'), conflicts: result.conflicts }),
    });
  };

  let body: ReactNode;
  if (query.isPending) body = <div className="text-muted">{t('common.loading')}</div>;
  else if (query.isError) body = <FormError error={query.error} />;
  else if (mode === 'view') {
    body = (
      <>
        {notice && (
          <div className="mb-4">
            <div role="status" className="text-sm font-semibold text-ok">
              {notice.text}
            </div>
            {notice.conflicts.length > 0 && (
              <ConflictsNote
                title={t('calendar.conflictsTitle')}
                items={notice.conflicts}
                timeZone={timeZone}
              />
            )}
          </div>
        )}
        {restore.isError && (
          <div className="mb-4">
            <FormError error={restore.error} />
          </div>
        )}
        <LessonDetails lesson={query.data} timeZone={timeZone} onEditLink={() => open('link')} />
      </>
    );
  } else {
    const Form = FORMS[mode];
    body = (
      <Form
        lesson={query.data}
        timeZone={timeZone}
        onDone={(next) => {
          setMode('view');
          setNotice(next);
        }}
        onBack={() => setMode('view')}
      />
    );
  }

  // A planned lesson is moved, re-staffed or cancelled; a cancelled one can only come back
  // (T-17, decision 2). Forms carry their own buttons.
  const footer =
    mode !== 'view' ? null : planned ? (
      <>
        <Button size="sm" onClick={() => open('reschedule')}>
          {t('calendar.reschedule')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => open('teacher')}>
          {t('calendar.replaceTeacher')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => open('cancel')}>
          {t('calendar.cancel')}
        </Button>
      </>
    ) : lesson?.status === 'cancelled' ? (
      <Button size="sm" disabled={restore.isPending} onClick={bringBack}>
        {t('calendar.restore')}
      </Button>
    ) : null;

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={lesson?.course.name}
      title={lesson?.groupName ?? t('common.loading')}
      closeLabel={t('calendar.close')}
      footer={footer || undefined}
    >
      {body}
    </Drawer>
  );
}
