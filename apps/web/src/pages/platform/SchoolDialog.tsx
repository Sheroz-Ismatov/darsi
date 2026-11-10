import {
  createSchoolRequestSchema,
  CURRENCIES,
  LOCALES,
  type Currency,
  type Locale,
  type PlanDto,
} from '@darsi/shared';
import { Button, Dialog, Field, Input, Select } from '@darsi/ui';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { useCreateSchool } from './platform-api';

/** Zones of the pilot markets: Tajikistan and its neighbours, then Russia west to east. */
const TIMEZONES = [
  'Asia/Dushanbe',
  'Asia/Tashkent',
  'Asia/Almaty',
  'Europe/Moscow',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Novosibirsk',
  'Asia/Krasnoyarsk',
  'Asia/Vladivostok',
];

const FORM_ID = 'create-school-form';

const FIELD_ERROR = {
  name: 'platform.errorName',
  ownerName: 'platform.errorName',
  code: 'platform.errorCode',
  planId: 'platform.errorPlan',
} as const;
type FieldName = keyof typeof FIELD_ERROR;

export function SchoolDialog({ plans, onClose }: { plans: PlanDto[]; onClose: () => void }) {
  const { t } = useTranslation();
  const createSchool = useCreateSchool();
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [code, setCode] = useState('');
  const [currency, setCurrency] = useState<Currency>('TJS');
  const [timezone, setTimezone] = useState(TIMEZONES[0] ?? '');
  const [defaultLocale, setDefaultLocale] = useState<Locale>('ru');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createSchoolRequestSchema.safeParse({
      name,
      ownerName,
      code: code || undefined,
      currency,
      timezone,
      defaultLocale,
      planId,
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    createSchool.mutate(parsed.data, { onSuccess: onClose });
  };

  const error = (field: FieldName) => (invalid.has(field) ? t(FIELD_ERROR[field]) : null);
  const codeTaken =
    createSchool.error instanceof ApiError && createSchool.error.code === 'SCHOOL_CODE_TAKEN';

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('platform.createTitle')}
      closeLabel={t('platform.close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={createSchool.isPending}>
            {t('platform.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field label={t('platform.fieldName')} htmlFor="school-name" error={error('name')}>
          <Input
            id="school-name"
            value={name}
            maxLength={120}
            aria-invalid={invalid.has('name')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label={t('platform.fieldOwnerName')}
          htmlFor="school-owner"
          hint={t('platform.fieldOwnerNameHint')}
          error={error('ownerName')}
        >
          <Input
            id="school-owner"
            value={ownerName}
            maxLength={120}
            aria-invalid={invalid.has('ownerName')}
            onChange={(event) => setOwnerName(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-x-4 max-[520px]:grid-cols-1">
          <Field label={t('platform.fieldCurrency')} htmlFor="school-currency">
            <Select
              id="school-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
            >
              {CURRENCIES.map((value) => (
                <option key={value} value={value}>
                  {t(`platform.currency${value}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('platform.fieldLocale')} htmlFor="school-locale">
            <Select
              id="school-locale"
              value={defaultLocale}
              onChange={(event) => setDefaultLocale(event.target.value as Locale)}
            >
              {LOCALES.map((value) => (
                <option key={value} value={value}>
                  {t(value === 'ru' ? 'platform.localeRu' : 'platform.localeTg')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('platform.fieldTimezone')} htmlFor="school-timezone">
            <Select
              id="school-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {TIMEZONES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('platform.fieldPlan')} htmlFor="school-plan" error={error('planId')}>
            <Select
              id="school-plan"
              value={planId}
              aria-invalid={invalid.has('planId')}
              onChange={(event) => setPlanId(event.target.value)}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label={t('platform.fieldCode')}
          htmlFor="school-code"
          hint={t('platform.fieldCodeHint')}
          error={codeTaken ? t('errors.SCHOOL_CODE_TAKEN') : error('code')}
          className="mb-0"
        >
          <Input
            id="school-code"
            value={code}
            maxLength={32}
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono"
            aria-invalid={invalid.has('code') || codeTaken}
            onChange={(event) => setCode(event.target.value.trim().toLowerCase())}
          />
        </Field>
        {createSchool.isError && !codeTaken && (
          <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {errorText(createSchool.error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
