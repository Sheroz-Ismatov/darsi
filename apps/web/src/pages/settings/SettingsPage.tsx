import {
  CURRENCIES,
  LOCALES,
  updateSchoolSettingsRequestSchema,
  type Currency,
  type Locale,
  type SchoolDto,
  type UpdateSchoolSettingsInput,
} from '@darsi/shared';
import { Button, Card, EmptyState, Field, Input, Select, Switch, Textarea } from '@darsi/ui';
import { Check, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/layout/PageHeader';
import { useSchool, useUpdateSchoolSettings } from '../../app/school';
import { errorText } from '../../lib/error-text';
import { timezoneOptions } from '../../lib/timezones';

const QR_SIZE = 512;

const FIELD_ERROR = {
  name: 'settings.errorName',
  address: 'settings.errorAddress',
  phone: 'settings.errorPhone',
  description: 'settings.errorDescription',
  reminderHoursBefore: 'settings.errorReminder',
} as const;
type ErrorField = keyof typeof FIELD_ERROR;

/**
 * Validates only the fields the user changed and saves them. Field-level problems come back
 * as a set of invalid field names; a failed request stays in `mutation.error`.
 */
function useSettingsForm() {
  const mutation = useUpdateSchoolSettings();
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  const save = (changes: UpdateSchoolSettingsInput) => {
    const parsed = updateSchoolSettingsRequestSchema.safeParse(changes);
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    mutation.mutate(parsed.data);
  };

  return { mutation, invalid, save };
}

interface SettingsCardProps {
  title: string;
  text?: string;
  dirty: boolean;
  form: ReturnType<typeof useSettingsForm>;
  onSubmit: () => void;
  children: ReactNode;
}

/** A card that saves on its own: the button wakes up on changes, a short note confirms the save. */
function SettingsCard({ title, text, dirty, form, onSubmit, children }: SettingsCardProps) {
  const { t } = useTranslation();
  const { mutation } = form;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{title}</h2>
        {text && <p className="mt-1 mb-0 text-[13px] text-muted">{text}</p>}
        <div className="mt-4">{children}</div>
        {mutation.isError && (
          <div role="alert" className="mb-3 text-[13px] font-semibold text-danger">
            {errorText(mutation.error)}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={!dirty || mutation.isPending}>
            {t('common.save')}
          </Button>
          {mutation.isSuccess && !dirty && (
            <span
              role="status"
              className="flex items-center gap-1 text-[13px] font-semibold text-ok"
            >
              <Check size={16} aria-hidden />
              {t('settings.saved')}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm font-semibold text-ink-2">
        {label}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

/** Profile fields as the form edits them: absent texts become empty strings. */
const profileValues = (school: SchoolDto) => ({
  name: school.name,
  address: school.address ?? '',
  phone: school.phone ?? '',
  description: school.description ?? '',
  timezone: school.timezone,
  currency: school.currency,
  defaultLocale: school.defaultLocale,
});

function ProfileCard({ school }: { school: SchoolDto }) {
  const { t } = useTranslation();
  const form = useSettingsForm();
  const [draft, setDraft] = useState(() => profileValues(school));

  const saved = profileValues(school);
  const keys = Object.keys(draft) as (keyof typeof draft)[];
  const changed = keys.filter((key) => draft[key].trim() !== saved[key]);

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    form.mutation.reset();
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const error = (field: ErrorField) =>
    form.invalid.has(field) ? t(FIELD_ERROR[field]) : undefined;

  return (
    <SettingsCard
      title={t('settings.profileTitle')}
      text={t('settings.profileText')}
      dirty={changed.length > 0}
      form={form}
      onSubmit={() => form.save(Object.fromEntries(changed.map((key) => [key, draft[key]])))}
    >
      <Field label={t('settings.fieldName')} htmlFor="settings-name" error={error('name')}>
        <Input
          id="settings-name"
          value={draft.name}
          maxLength={120}
          aria-invalid={form.invalid.has('name')}
          onChange={(event) => set('name', event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-x-4 max-[520px]:grid-cols-1">
        <Field
          label={t('settings.fieldAddress')}
          htmlFor="settings-address"
          error={error('address')}
        >
          <Input
            id="settings-address"
            value={draft.address}
            maxLength={200}
            aria-invalid={form.invalid.has('address')}
            onChange={(event) => set('address', event.target.value)}
          />
        </Field>
        <Field label={t('settings.fieldPhone')} htmlFor="settings-phone" error={error('phone')}>
          <Input
            id="settings-phone"
            type="tel"
            value={draft.phone}
            maxLength={32}
            placeholder="+992 93 123-45-67"
            aria-invalid={form.invalid.has('phone')}
            onChange={(event) => set('phone', event.target.value)}
          />
        </Field>
      </div>
      <Field
        label={t('settings.fieldDescription')}
        htmlFor="settings-description"
        hint={t('settings.descriptionHint')}
        error={error('description')}
      >
        <Textarea
          id="settings-description"
          rows={4}
          value={draft.description}
          maxLength={1000}
          aria-invalid={form.invalid.has('description')}
          onChange={(event) => set('description', event.target.value)}
        />
      </Field>
      <Field
        label={t('settings.fieldTimezone')}
        htmlFor="settings-timezone"
        hint={t('settings.timezoneHint')}
      >
        <Select
          id="settings-timezone"
          value={draft.timezone}
          onChange={(event) => set('timezone', event.target.value)}
        >
          {timezoneOptions(school.timezone).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-x-4 max-[520px]:grid-cols-1">
        <Field
          label={t('settings.fieldCurrency')}
          htmlFor="settings-currency"
          hint={school.currencyLocked ? t('settings.currencyLocked') : undefined}
        >
          <Select
            id="settings-currency"
            value={draft.currency}
            disabled={school.currencyLocked}
            onChange={(event) => set('currency', event.target.value as Currency)}
          >
            {CURRENCIES.map((value) => (
              <option key={value} value={value}>
                {t(`platform.currency${value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('settings.fieldLocale')} htmlFor="settings-locale">
          <Select
            id="settings-locale"
            value={draft.defaultLocale}
            onChange={(event) => set('defaultLocale', event.target.value as Locale)}
          >
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {t(value === 'ru' ? 'platform.localeRu' : 'platform.localeTg')}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </SettingsCard>
  );
}

function ChargeCard({ school }: { school: SchoolDto }) {
  const { t } = useTranslation();
  const form = useSettingsForm();
  const [chargeAbsent, setChargeAbsent] = useState(school.chargeAbsent);
  const [chargeExcused, setChargeExcused] = useState(school.chargeExcused);

  const changes: UpdateSchoolSettingsInput = {
    ...(chargeAbsent !== school.chargeAbsent && { chargeAbsent }),
    ...(chargeExcused !== school.chargeExcused && { chargeExcused }),
  };
  const edit = (setter: (value: boolean) => void) => (value: boolean) => {
    form.mutation.reset();
    setter(value);
  };

  return (
    <SettingsCard
      title={t('settings.chargeTitle')}
      text={t('settings.chargeText')}
      dirty={Object.keys(changes).length > 0}
      form={form}
      onSubmit={() => form.save(changes)}
    >
      <SwitchRow
        id="settings-charge-absent"
        label={t('settings.chargeAbsent')}
        checked={chargeAbsent}
        onChange={edit(setChargeAbsent)}
      />
      <SwitchRow
        id="settings-charge-excused"
        label={t('settings.chargeExcused')}
        checked={chargeExcused}
        onChange={edit(setChargeExcused)}
      />
    </SettingsCard>
  );
}

function RemindersCard({ school }: { school: SchoolDto }) {
  const { t } = useTranslation();
  const form = useSettingsForm();
  const [hours, setHours] = useState(String(school.reminderHoursBefore));
  const [debt, setDebt] = useState(school.debtRemindersEnabled);

  const hoursChanged = hours.trim() !== String(school.reminderHoursBefore);
  const changes: UpdateSchoolSettingsInput = {
    ...(hoursChanged && { reminderHoursBefore: hours.trim() === '' ? NaN : Number(hours) }),
    ...(debt !== school.debtRemindersEnabled && { debtRemindersEnabled: debt }),
  };

  return (
    <SettingsCard
      title={t('settings.remindersTitle')}
      dirty={Object.keys(changes).length > 0}
      form={form}
      onSubmit={() => form.save(changes)}
    >
      <Field
        label={t('settings.reminderHours')}
        htmlFor="settings-reminder-hours"
        hint={t('settings.reminderHoursHint')}
        error={form.invalid.has('reminderHoursBefore') ? t(FIELD_ERROR.reminderHoursBefore) : null}
      >
        <Input
          id="settings-reminder-hours"
          type="number"
          inputMode="numeric"
          min={1}
          max={48}
          step={1}
          value={hours}
          className="max-w-32 font-mono"
          aria-invalid={form.invalid.has('reminderHoursBefore')}
          onChange={(event) => {
            form.mutation.reset();
            setHours(event.target.value);
          }}
        />
      </Field>
      <SwitchRow
        id="settings-debt-reminders"
        label={t('settings.debtReminders')}
        checked={debt}
        onChange={(value) => {
          form.mutation.reset();
          setDebt(value);
        }}
      />
    </SettingsCard>
  );
}

function JoinLinkCard({ school }: { school: SchoolDto }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(school.joinUrl, { width: QR_SIZE, margin: 2 }).then((url) => {
      if (active) setQr(url);
    });
    return () => {
      active = false;
    };
  }, [school.joinUrl]);

  const copy = () => {
    void navigator.clipboard.writeText(school.joinUrl).then(() => setCopied(true));
  };

  const download = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr;
    link.download = `darsi-${school.code}.png`;
    link.click();
  };

  return (
    <Card>
      <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{t('settings.joinTitle')}</h2>
      <p className="mt-1 mb-4 text-[13px] text-muted">{t('settings.joinText')}</p>
      <div className="mb-4 flex gap-2">
        <Input
          readOnly
          value={school.joinUrl}
          aria-label={t('settings.joinTitle')}
          className="font-mono text-[13px]"
          onFocus={(event) => event.target.select()}
        />
        <Button variant="lime" className="shrink-0" onClick={copy}>
          {t(copied ? 'settings.copied' : 'settings.copy')}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid size-44 place-items-center rounded-md border border-hairline bg-surface">
          {qr && (
            <img
              src={qr}
              alt={t('settings.qrAlt')}
              data-join-url={school.joinUrl}
              className="size-40"
            />
          )}
        </div>
        <Button variant="ghost" disabled={!qr} onClick={download}>
          <Download size={16} aria-hidden />
          {t('settings.downloadQr')}
        </Button>
      </div>
    </Card>
  );
}

/** W-13: school profile, absence and reminder rules, the parents' link and QR (TZ FR-7…FR-9). */
export function SettingsPage() {
  const { t } = useTranslation();
  const school = useSchool();

  return (
    <>
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('nav.settings')} />
      {school.isPending ? (
        <div className="text-muted">{t('common.loading')}</div>
      ) : school.isError ? (
        <EmptyState
          title={errorText(school.error)}
          action={
            <Button variant="ghost" onClick={() => void school.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        // Keyed by school: switching schools must not carry a draft over.
        <div
          key={school.data.id}
          className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-4 max-[1000px]:grid-cols-1"
        >
          <ProfileCard school={school.data} />
          <div className="flex flex-col gap-4">
            <ChargeCard school={school.data} />
            <RemindersCard school={school.data} />
            <JoinLinkCard school={school.data} />
          </div>
        </div>
      )}
    </>
  );
}
