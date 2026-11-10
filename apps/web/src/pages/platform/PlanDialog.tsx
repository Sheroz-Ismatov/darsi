import { createPlanRequestSchema, type PlanDto } from '@darsi/shared';
import { Button, Dialog, Field, Input } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../lib/error-text';
import { useSavePlan } from './platform-api';

const FORM_ID = 'plan-form';
const LIMITS = [
  { field: 'maxStudents', label: 'platform.planMaxStudents' },
  { field: 'maxStaff', label: 'platform.planMaxStaff' },
  { field: 'maxStorageMb', label: 'platform.planMaxStorage' },
] as const;

type LimitField = (typeof LIMITS)[number]['field'];

/** Creates a plan, or edits the limits of an existing one (TZ FR-6). */
export function PlanDialog({ plan, onClose }: { plan: PlanDto | null; onClose: () => void }) {
  const { t } = useTranslation();
  const savePlan = useSavePlan();
  const [name, setName] = useState(plan?.name ?? '');
  const [limits, setLimits] = useState<Record<LimitField, string>>({
    maxStudents: String(plan?.maxStudents ?? 500),
    maxStaff: String(plan?.maxStaff ?? 30),
    maxStorageMb: String(plan?.maxStorageMb ?? 1024),
  });
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createPlanRequestSchema.safeParse({
      name,
      maxStudents: Number(limits.maxStudents),
      maxStaff: Number(limits.maxStaff),
      maxStorageMb: Number(limits.maxStorageMb),
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    savePlan.mutate({ ...parsed.data, id: plan?.id }, { onSuccess: onClose });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        plan ? t('platform.planEditTitle', { name: plan.name }) : t('platform.planCreateTitle')
      }
      closeLabel={t('platform.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={savePlan.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field
          label={t('platform.planName')}
          htmlFor="plan-name"
          error={invalid.has('name') ? t('platform.errorPlanName') : null}
        >
          <Input
            id="plan-name"
            value={name}
            maxLength={64}
            aria-invalid={invalid.has('name')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {LIMITS.map(({ field, label }) => (
          <Field
            key={field}
            label={t(label)}
            htmlFor={`plan-${field}`}
            error={invalid.has(field) ? t('platform.planLimitHint') : null}
          >
            <Input
              id={`plan-${field}`}
              inputMode="numeric"
              value={limits[field]}
              aria-invalid={invalid.has(field)}
              onChange={(event) => setLimits({ ...limits, [field]: event.target.value.trim() })}
            />
          </Field>
        ))}
        {savePlan.isError && (
          <div role="alert" className="text-[13px] font-semibold text-danger">
            {errorText(savePlan.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
