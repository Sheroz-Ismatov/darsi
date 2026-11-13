import {
  BIRTH_YEAR_MIN,
  createStudentRequestSchema,
  GUARDIAN_RELATIONS,
  STUDENT_COMMENT_MAX,
  STUDENT_NAME_MAX,
  updateStudentRequestSchema,
  type GuardianRelation,
  type StudentDetailDto,
} from '@darsi/shared';
import { Button, Dialog, Eyebrow, Field, Input, Select, Textarea } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { errorText } from '../../lib/error-text';
import { RELATION_LABEL } from './student-format';
import { useCreateStudent, useUpdateStudent } from './students-api';

const FORM_ID = 'student-form';

const FIELD_ERROR = {
  firstName: 'students.errorName',
  lastName: 'students.errorName',
  birthDate: 'students.errorBirthDate',
  comment: 'students.errorComment',
  'guardian.name': 'students.errorName',
  'guardian.phone': 'students.errorPhone',
} as const;
type ErrorField = keyof typeof FIELD_ERROR;

/** State the card reads after a new student opens it. */
export interface StudentCreatedState {
  guardianReused: boolean;
}

interface StudentDialogProps {
  /** Absent for a new student. */
  student?: StudentDetailDto;
  onClose: () => void;
}

/** W-6/W-7: a new student with a parent, or the student's own data (TZ FR-17). */
export function StudentDialog({ student, onClose }: StudentDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const save = student ? updateStudent : createStudent;

  const [lastName, setLastName] = useState(student?.lastName ?? '');
  const [firstName, setFirstName] = useState(student?.firstName ?? '');
  const [birthDate, setBirthDate] = useState(student?.birthDate ?? '');
  const [comment, setComment] = useState(student?.comment ?? '');
  const [guardianName, setGuardianName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState<GuardianRelation>('mother');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const fields = { lastName, firstName, birthDate, comment };
    const reject = (issues: { path: PropertyKey[] }[]) =>
      setInvalid(new Set(issues.map((issue) => issue.path.map(String).join('.'))));
    if (student) {
      const parsed = updateStudentRequestSchema.safeParse(fields);
      if (!parsed.success) return reject(parsed.error.issues);
      setInvalid(new Set());
      updateStudent.mutate({ id: student.id, ...parsed.data }, { onSuccess: onClose });
      return;
    }
    const parsed = createStudentRequestSchema.safeParse({
      ...fields,
      guardian: { name: guardianName, phone, relation },
    });
    if (!parsed.success) return reject(parsed.error.issues);
    setInvalid(new Set());
    createStudent.mutate(parsed.data, {
      onSuccess: (result) => {
        const state: StudentCreatedState = { guardianReused: result.guardianReused };
        void navigate(`/students/${result.student.id}`, { state });
      },
    });
  };

  const error = (field: ErrorField) => (invalid.has(field) ? t(FIELD_ERROR[field]) : null);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(student ? 'students.editTitle' : 'students.createTitle')}
      closeLabel={t('students.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {t(student ? 'students.save' : 'students.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
          <Field
            label={t('students.fieldLastName')}
            htmlFor="student-last-name"
            error={error('lastName')}
          >
            <Input
              id="student-last-name"
              value={lastName}
              maxLength={STUDENT_NAME_MAX}
              autoComplete="off"
              aria-invalid={invalid.has('lastName')}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
          <Field
            label={t('students.fieldFirstName')}
            htmlFor="student-first-name"
            error={error('firstName')}
          >
            <Input
              id="student-first-name"
              value={firstName}
              maxLength={STUDENT_NAME_MAX}
              autoComplete="off"
              aria-invalid={invalid.has('firstName')}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
        </div>
        <Field
          label={t('students.fieldBirthDate')}
          htmlFor="student-birth-date"
          error={error('birthDate')}
        >
          <Input
            id="student-birth-date"
            type="date"
            min={`${BIRTH_YEAR_MIN}-01-01`}
            value={birthDate}
            aria-invalid={invalid.has('birthDate')}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </Field>
        <Field
          label={t('students.fieldComment')}
          htmlFor="student-comment"
          hint={t('students.commentHint')}
          error={error('comment')}
        >
          <Textarea
            id="student-comment"
            rows={2}
            value={comment}
            maxLength={STUDENT_COMMENT_MAX}
            aria-invalid={invalid.has('comment')}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>

        {!student && (
          <>
            <Eyebrow className="mt-2 mb-3">{t('students.guardianTitle')}</Eyebrow>
            <Field
              label={t('students.fieldGuardianName')}
              htmlFor="guardian-name"
              error={error('guardian.name')}
            >
              <Input
                id="guardian-name"
                value={guardianName}
                maxLength={STUDENT_NAME_MAX}
                autoComplete="off"
                aria-invalid={invalid.has('guardian.name')}
                onChange={(event) => setGuardianName(event.target.value)}
              />
            </Field>
            <GuardianContactFields
              phone={phone}
              relation={relation}
              phoneError={error('guardian.phone')}
              onPhone={setPhone}
              onRelation={setRelation}
            />
          </>
        )}

        {save.isError && (
          <div role="alert" className="mt-2 text-[13px] font-semibold text-danger">
            {errorText(save.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}

interface GuardianContactFieldsProps {
  phone: string;
  relation: GuardianRelation;
  phoneError: string | null;
  onPhone: (value: string) => void;
  onRelation: (value: GuardianRelation) => void;
}

/** Phone and "who they are" of a parent: the same pair in the new student and new parent forms. */
export function GuardianContactFields({
  phone,
  relation,
  phoneError,
  onPhone,
  onRelation,
}: GuardianContactFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
      <Field
        label={t('students.fieldPhone')}
        htmlFor="guardian-phone"
        hint={t('students.phoneHint')}
        error={phoneError}
      >
        <Input
          id="guardian-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={32}
          placeholder="+992 90 123-45-67"
          aria-invalid={phoneError !== null}
          onChange={(event) => onPhone(event.target.value)}
        />
      </Field>
      <Field label={t('students.fieldRelation')} htmlFor="guardian-relation">
        <Select
          id="guardian-relation"
          value={relation}
          onChange={(event) => onRelation(event.target.value as GuardianRelation)}
        >
          {GUARDIAN_RELATIONS.map((value) => (
            <option key={value} value={value}>
              {t(RELATION_LABEL[value])}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
