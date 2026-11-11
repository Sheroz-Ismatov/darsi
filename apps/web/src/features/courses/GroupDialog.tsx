import {
  createGroupRequestSchema,
  updateGroupRequestSchema,
  type CourseFormat,
  type CourseKind,
  type GroupDto,
} from '@darsi/shared';
import { Button, Dialog, Field, Input, Select } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SECTION_PATH } from '../../app/auth/access';
import { useSession } from '../../app/auth/session';
import { errorText } from '../../lib/error-text';
import { useCreateGroup, useTeachers, useUpdateGroup } from './courses-api';

const FORM_ID = 'group-form';

const FIELD_ERROR = {
  name: 'groups.errorName',
  teacherMembershipId: 'groups.errorTeacher',
  capacity: 'groups.errorCapacity',
  meetingUrl: 'groups.errorMeetingUrl',
  startsOn: 'groups.errorDates',
  endsOn: 'groups.errorDates',
} as const;
type ErrorField = keyof typeof FIELD_ERROR;

export interface GroupDialogCourse {
  id: string;
  kind: CourseKind;
  format: CourseFormat;
}

interface GroupDialogProps {
  course: GroupDialogCourse;
  /** Absent for a new group. */
  group?: GroupDto;
  onClose: () => void;
}

/** W-4/W-5 group form (TZ FR-12): teacher, seats, call link for an online course, dates. */
export function GroupDialog({ course, group, onClose }: GroupDialogProps) {
  const { t } = useTranslation();
  const isOwner = useSession().school?.roles.includes('owner') ?? false;
  const teachers = useTeachers();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const save = group ? updateGroup : createGroup;

  const individual = course.kind === 'individual';
  const online = course.format === 'online';
  const [name, setName] = useState(group?.name ?? '');
  const [teacherId, setTeacherId] = useState(group?.teacher.id ?? '');
  const [capacity, setCapacity] = useState(String(group?.capacity ?? (individual ? 1 : 10)));
  const [meetingUrl, setMeetingUrl] = useState(group?.meetingUrl ?? '');
  const [startsOn, setStartsOn] = useState(group?.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(group?.endsOn ?? '');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const options = teachers.data ?? [];
  // A teacher who has left may still lead this group; keep them selectable while editing.
  const keepsLeftTeacher = group && !options.some((member) => member.id === group.teacher.id);
  const noTeachers = teachers.isSuccess && options.length === 0 && !group;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = {
      name,
      teacherMembershipId: teacherId,
      // An individual course always has one seat; the server enforces it as well.
      capacity: individual ? 1 : Number(capacity),
      ...(online && { meetingUrl }),
      startsOn,
      endsOn,
    };
    const reject = (issues: { path: PropertyKey[] }[]) =>
      setInvalid(new Set(issues.map((issue) => String(issue.path[0]))));
    if (group) {
      const parsed = updateGroupRequestSchema.safeParse(fields);
      if (!parsed.success) return reject(parsed.error.issues);
      setInvalid(new Set());
      updateGroup.mutate({ id: group.id, ...parsed.data }, { onSuccess: onClose });
    } else {
      const parsed = createGroupRequestSchema.safeParse({ courseId: course.id, ...fields });
      if (!parsed.success) return reject(parsed.error.issues);
      setInvalid(new Set());
      createGroup.mutate(parsed.data, { onSuccess: onClose });
    }
  };

  const error = (field: ErrorField) => (invalid.has(field) ? t(FIELD_ERROR[field]) : null);
  const datesError = error('endsOn') ?? error('startsOn');

  return (
    <Dialog
      open
      onClose={onClose}
      title={group ? t('groups.editTitle', { name: group.name }) : t('groups.createTitle')}
      closeLabel={t('groups.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending || noTeachers}>
            {t(group ? 'groups.save' : 'groups.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field
          label={t('groups.fieldName')}
          htmlFor="group-name"
          hint={t('groups.nameHint')}
          error={error('name')}
        >
          <Input
            id="group-name"
            value={name}
            maxLength={120}
            aria-invalid={invalid.has('name')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          label={t('groups.fieldTeacher')}
          htmlFor="group-teacher"
          error={error('teacherMembershipId')}
        >
          {noTeachers ? (
            <div className="rounded-md border border-dashed border-hairline px-4 py-3.5 text-[13px]">
              <div className="font-semibold">{t('groups.noTeachers')}</div>
              <div className="mt-1 text-muted">
                {t(isOwner ? 'groups.noTeachersOwner' : 'groups.noTeachersAdmin')}
              </div>
              {isOwner && (
                <Link
                  to={SECTION_PATH.staff}
                  className="mt-2 inline-block font-semibold underline decoration-lime decoration-[3px] underline-offset-4"
                >
                  {t('groups.toStaff')}
                </Link>
              )}
            </div>
          ) : (
            <Select
              id="group-teacher"
              value={teacherId}
              aria-invalid={invalid.has('teacherMembershipId')}
              disabled={teachers.isPending}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">{t('groups.chooseTeacher')}</option>
              {keepsLeftTeacher && (
                <option value={group.teacher.id}>{group.teacher.displayName}</option>
              )}
              {options.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.status === 'invited'
                    ? t('groups.teacherInvited', { name: member.displayName })
                    : member.displayName}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {!individual && (
          <Field
            label={t('groups.fieldCapacity')}
            htmlFor="group-capacity"
            hint={t('groups.capacityHint')}
            error={error('capacity')}
          >
            <Input
              id="group-capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={capacity}
              aria-invalid={invalid.has('capacity')}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </Field>
        )}

        {online && (
          <Field
            label={t('groups.fieldMeetingUrl')}
            htmlFor="group-meeting-url"
            hint={t('groups.meetingUrlHint')}
            error={error('meetingUrl')}
          >
            <Input
              id="group-meeting-url"
              type="url"
              value={meetingUrl}
              maxLength={500}
              placeholder="https://"
              aria-invalid={invalid.has('meetingUrl')}
              onChange={(event) => setMeetingUrl(event.target.value)}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('groups.fieldStartsOn')} htmlFor="group-starts-on" className="mb-2">
            <Input
              id="group-starts-on"
              type="date"
              value={startsOn}
              aria-invalid={invalid.has('startsOn')}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </Field>
          <Field label={t('groups.fieldEndsOn')} htmlFor="group-ends-on" className="mb-2">
            <Input
              id="group-ends-on"
              type="date"
              value={endsOn}
              aria-invalid={invalid.has('endsOn')}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </Field>
        </div>
        {datesError ? (
          <div role="alert" className="text-xs font-semibold text-danger">
            {datesError}
          </div>
        ) : (
          <div className="text-xs text-muted">{t('groups.datesHint')}</div>
        )}

        {save.isError && (
          <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {errorText(save.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
