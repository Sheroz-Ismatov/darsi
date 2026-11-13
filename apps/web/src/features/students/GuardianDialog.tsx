import { addGuardianRequestSchema, STUDENT_NAME_MAX, type GuardianRelation } from '@darsi/shared';
import { Button, Dialog, Field, Input } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../lib/error-text';
import { GuardianContactFields } from './StudentDialog';
import { useAddGuardian } from './students-api';

const FORM_ID = 'guardian-form';

interface GuardianDialogProps {
  studentId: string;
  /** Called with `guardianReused` once the parent is linked. */
  onDone: (guardianReused: boolean) => void;
  onClose: () => void;
}

/** W-7: a second parent of a student (TZ FR-17); a known phone links the existing parent. */
export function GuardianDialog({ studentId, onDone, onClose }: GuardianDialogProps) {
  const { t } = useTranslation();
  const addGuardian = useAddGuardian();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<GuardianRelation>('father');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = addGuardianRequestSchema.safeParse({ name, phone, relation });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    addGuardian.mutate(
      { studentId, ...parsed.data },
      { onSuccess: (result) => onDone(result.guardianReused) },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('students.guardianTitleNew')}
      closeLabel={t('students.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={addGuardian.isPending}>
            {t('students.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field
          label={t('students.fieldGuardianName')}
          htmlFor="new-guardian-name"
          error={invalid.has('name') ? t('students.errorName') : null}
        >
          <Input
            id="new-guardian-name"
            value={name}
            maxLength={STUDENT_NAME_MAX}
            autoComplete="off"
            aria-invalid={invalid.has('name')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <GuardianContactFields
          phone={phone}
          relation={relation}
          phoneError={invalid.has('phone') ? t('students.errorPhone') : null}
          onPhone={setPhone}
          onRelation={setRelation}
        />
        {addGuardian.isError && (
          <div role="alert" className="mt-2 text-[13px] font-semibold text-danger">
            {errorText(addGuardian.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
