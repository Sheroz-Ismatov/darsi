import { Button } from '@darsi/ui';
import { useTranslation } from 'react-i18next';

/** Full-screen state while signing in through Telegram, or when it failed. */
export function SessionFallback({
  state,
  retry,
}: {
  state: 'loading' | 'error';
  retry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="grid size-14 place-items-center rounded-[16px] bg-ink font-mono text-xl font-bold text-lime">
        D
      </div>
      {state === 'loading' ? (
        <p className="m-0 text-muted">{t('common.loading')}</p>
      ) : (
        <>
          <p className="m-0 max-w-xs">{t('tma.authError')}</p>
          <Button variant="ghost" onClick={retry}>
            {t('common.retry')}
          </Button>
        </>
      )}
    </div>
  );
}
