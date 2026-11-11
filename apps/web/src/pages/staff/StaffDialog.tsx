import { createStaffRequestSchema, type StaffInviteRole } from '@darsi/shared';
import { Button, Dialog, Field, Input, Segmented } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../lib/error-text';
import { useCreateStaff } from './staff-api';

const FORM_ID = 'create-staff-form';

/** Adds an invited admin or teacher; the link is issued from the list afterwards (TZ FR-10). */
export function StaffDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const createStaff = useCreateStaff();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffInviteRole>('teacher');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createStaffRequestSchema.safeParse({ displayName, phone, role });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    createStaff.mutate(parsed.data, { onSuccess: onClose });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('staff.addTitle')}
      closeLabel={t('staff.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={createStaff.isPending}>
            {t('staff.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">{t('staff.fieldRole')}</span>
          <Segmented
            label={t('staff.fieldRole')}
            value={role}
            onChange={setRole}
            options={[
              { value: 'admin', label: t('staff.roleAdmin') },
              { value: 'teacher', label: t('staff.roleTeacher') },
            ]}
          />
        </div>
        <Field
          label={t('staff.fieldName')}
          htmlFor="staff-name"
          hint={t('staff.fieldNameHint')}
          error={invalid.has('displayName') ? t('staff.errorName') : null}
        >
          <Input
            id="staff-name"
            value={displayName}
            maxLength={120}
            aria-invalid={invalid.has('displayName')}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <Field
          label={t('staff.fieldPhone')}
          htmlFor="staff-phone"
          hint={t('staff.fieldPhoneHint')}
          error={invalid.has('phone') ? t('staff.errorPhone') : null}
          className="mb-0"
        >
          <Input
            id="staff-phone"
            type="tel"
            value={phone}
            maxLength={32}
            placeholder="+992 93 123-45-67"
            aria-invalid={invalid.has('phone')}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        {createStaff.isError && (
          <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {errorText(createStaff.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
