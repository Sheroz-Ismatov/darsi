import type { GroupFullDetails } from '@darsi/shared';
import { Button, Dialog, Field, Input, Select } from '@darsi/ui';
import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCourses } from '../courses/courses-api';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { useEnroll, useTransferEnrollment } from './students-api';

const FORM_ID = 'enroll-form';

export interface TransferSource {
  enrollmentId: string;
  groupName: string;
}

interface EnrollDialogProps {
  studentId: string;
  studentName: string;
  /** Groups the student is in now: they are not offered again. */
  currentGroupIds: readonly string[];
  /** Set for a transfer: this enrollment ends where the new one starts. */
  from?: TransferSource;
  onClose: () => void;
}

/**
 * W-7: enrollment into a group or a transfer (TZ FR-21). A full group is a warning, not a wall:
 * the second click sends `force` (T-18, decision 6).
 */
export function EnrollDialog({
  studentId,
  studentName,
  currentGroupIds,
  from,
  onClose,
}: EnrollDialogProps) {
  const { t } = useTranslation();
  const courses = useCourses(false);
  const enroll = useEnroll();
  const transfer = useTransferEnrollment();
  const save = from ? transfer : enroll;
  const [courseId, setCourseId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [groupMissing, setGroupMissing] = useState(false);

  const fullDetails =
    save.error instanceof ApiError && save.error.code === 'GROUP_FULL'
      ? (save.error.details as unknown as GroupFullDetails)
      : null;

  const options = (courses.data ?? [])
    .map((course) => ({
      ...course,
      groups: course.groups.filter(
        (group) => !group.archived && !currentGroupIds.includes(group.id),
      ),
    }))
    .filter((course) => course.groups.length > 0);
  const groups = options.find((course) => course.id === courseId)?.groups ?? [];
  const noGroups = courses.isSuccess && options.length === 0;

  const send = (force: boolean) => {
    if (!groupId) {
      setGroupMissing(true);
      return;
    }
    setGroupMissing(false);
    const dateField = date || undefined;
    const callbacks = { onSuccess: onClose };
    if (from) {
      transfer.mutate({ id: from.enrollmentId, groupId, date: dateField, force }, callbacks);
    } else {
      enroll.mutate({ studentId, groupId, enrolledOn: dateField, force }, callbacks);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(false);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(from ? 'students.transferTitle' : 'students.enrollTitle', { name: studentName })}
      closeLabel={t('students.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {fullDetails ? (
            <Button disabled={save.isPending} onClick={() => send(true)}>
              {t('students.force')}
            </Button>
          ) : (
            <Button type="submit" form={FORM_ID} disabled={save.isPending || noGroups}>
              {t(from ? 'students.confirmTransfer' : 'students.confirmEnroll')}
            </Button>
          )}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        {from && (
          <p className="mt-0 mb-4 text-ink-2">
            {t('students.transferFrom', { group: from.groupName })}
          </p>
        )}
        {noGroups ? (
          <div className="rounded-md border border-dashed border-hairline px-4 py-3.5 text-[13px]">
            {t('students.noCourses')}
          </div>
        ) : (
          <>
            <Field label={t('students.fieldCourse')} htmlFor="enroll-course">
              <Select
                id="enroll-course"
                value={courseId}
                disabled={courses.isPending}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setGroupId('');
                  save.reset();
                }}
              >
                <option value="">{t('students.chooseCourse')}</option>
                {options.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t('students.fieldGroup')}
              htmlFor="enroll-group"
              error={groupMissing ? t('students.errorGroup') : null}
            >
              <Select
                id="enroll-group"
                value={groupId}
                disabled={!courseId}
                aria-invalid={groupMissing}
                onChange={(event) => {
                  setGroupId(event.target.value);
                  save.reset();
                }}
              >
                <option value="">{t('students.chooseGroup')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.freeSeats > 0
                      ? t('students.groupSeats', { name: group.name, n: group.freeSeats })
                      : t('students.groupFull', { name: group.name })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t(from ? 'students.fieldTransferDate' : 'students.fieldEnrolledOn')}
              htmlFor="enroll-date"
              hint={t('students.dateHint')}
              className="mb-0"
            >
              <Input
                id="enroll-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </>
        )}

        {fullDetails ? (
          <div role="alert" className="mt-4 rounded-md bg-warn-bg p-4 text-warn">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <TriangleAlert size={16} aria-hidden />
              {t('students.fullTitle')}
            </div>
            <div className="text-sm">{t('students.fullText', { ...fullDetails })}</div>
          </div>
        ) : (
          save.isError && (
            <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
              {errorText(save.error)}
            </div>
          )
        )}
      </form>
    </Dialog>
  );
}
