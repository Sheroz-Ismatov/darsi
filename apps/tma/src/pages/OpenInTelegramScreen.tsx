import { useTranslation } from 'react-i18next';

/** Shown when the Mini App URL is opened in a regular browser. */
export function OpenInTelegramScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="grid size-14 place-items-center rounded-[16px] bg-ink font-mono text-xl font-bold text-lime">
        D
      </div>
      <h1 className="m-0 text-[28px] leading-tight font-bold tracking-[-0.03em]">
        {t('tma.openInTelegramTitle')}
      </h1>
      <p className="m-0 max-w-xs text-muted">{t('tma.openInTelegramText')}</p>
    </div>
  );
}
