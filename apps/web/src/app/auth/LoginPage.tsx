import { Button, Card, Field, Input } from '@darsi/ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { SECTION_PATH } from './access';
import { useAuth } from './session';
import { TelegramLoginButton } from './TelegramLoginButton';

const BOT_USERNAME: string | undefined = import.meta.env.VITE_BOT_USERNAME || undefined;

function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <Card className="w-full max-w-[420px] p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[14px] bg-ink font-mono font-bold text-lime">
            D
          </div>
          <span className="text-lg font-bold tracking-[-0.02em]">{t('common.appName')}</span>
        </div>
        <h1 className="m-0 mb-2 text-[32px] leading-tight font-bold tracking-[-0.03em]">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function DevLoginForm({ onError }: { onError: (text: string | null) => void }) {
  const { t } = useTranslation();
  const { devLogin } = useAuth();
  const [telegramId, setTelegramId] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[1-9]\d{0,14}$/.test(telegramId)) {
      onError(t('auth.devInvalidId'));
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await devLogin(Number(telegramId));
    } catch (error) {
      const disabled = error instanceof ApiError && error.status === 404;
      onError(disabled ? t('auth.devDisabled') : errorText(error));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 border-t border-hairline pt-5">
      <Field label={t('auth.devTitle')} htmlFor="dev-telegram-id" hint={t('auth.devHint')}>
        <Input
          id="dev-telegram-id"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('auth.devTelegramId')}
          value={telegramId}
          onChange={(event) => setTelegramId(event.target.value.trim())}
        />
      </Field>
      <Button type="submit" block disabled={busy}>
        {t('auth.devSubmit')}
      </Button>
    </form>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { session, telegramLogin, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (session) {
    const first = session.sections[0];
    if (first) return <Navigate to={SECTION_PATH[first]} replace />;
    // Signed in, but neither a superadmin nor an owner/admin anywhere (TZ FR-3).
    return (
      <AuthScreen title={t('auth.noAccessTitle')}>
        <p className="mt-0 mb-6 text-ink-2">{t('auth.noAccessText')}</p>
        <Button variant="ghost" block onClick={() => void signOut()}>
          {t('common.logout')}
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t('auth.title')}>
      <p className="mt-0 mb-6 text-ink-2">{t('auth.text')}</p>
      {BOT_USERNAME ? (
        <TelegramLoginButton
          botUsername={BOT_USERNAME}
          onAuth={(user) => {
            setError(null);
            telegramLogin(user).catch((e: unknown) => setError(errorText(e)));
          }}
        />
      ) : (
        <p className="m-0 text-[13px] text-muted">{t('auth.widgetUnavailable')}</p>
      )}
      {error && (
        <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
          {error}
        </div>
      )}
      {import.meta.env.DEV && <DevLoginForm onError={setError} />}
    </AuthScreen>
  );
}
