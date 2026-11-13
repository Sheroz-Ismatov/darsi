import { Button, Dialog, Field, Input } from '@darsi/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../lib/error-text';
import { useLeaveEnrollment } from './students-api';

interface LeaveDialogProps {
  enrollmentId: string;
  groupName: string;
  /** Earliest allowed date: the enrollment date, when known. */
  enrolledOn?: string;
  onClose: () => void;
}

/** Leaving a group frees the seat and keeps the enrollment as history (TZ FR-21). */
export function LeaveDialog({ enrollmentId, groupName, enrolledOn, onClose }: LeaveDialogProps) {
  const { t } = useTranslation();
  const leave = useLeaveEnrollment();
  const [leftOn, setLeftOn] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('students.leaveTitle', { group: groupName })}
      closeLabel={t('students.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={leave.isPending}
            onClick={() =>
              leave.mutate(
                { id: enrollmentId, leftOn: leftOn || undefined },
                { onSuccess: onClose },
              )
            }
          >
            {t('students.leave')}
          </Button>
        </>
      }
    >
      <p className="mt-0 mb-4 text-ink-2">{t('students.leaveText')}</p>
      <Field
        label={t('students.fieldLeftOn')}
        htmlFor="leave-date"
        hint={t('students.dateHint')}
        className="mb-0"
      >
        <Input
          id="leave-date"
          type="date"
          min={enrolledOn}
          value={leftOn}
          onChange={(event) => setLeftOn(event.target.value)}
        />
      </Field>
      {leave.isError && (
        <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {errorText(leave.error)}
        </div>
      )}
    </Dialog>
  );
}
