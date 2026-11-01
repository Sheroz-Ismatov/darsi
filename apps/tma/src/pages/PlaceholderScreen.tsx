import type { Dictionary } from '@darsi/shared';
import { EmptyState } from '@darsi/ui';
import { useTranslation } from 'react-i18next';

/** Screen that is not implemented yet; replaced task by task (IMPLEMENTATION_PLAN.md). */
export function PlaceholderScreen({ title }: { title: keyof Dictionary['nav'] }) {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="mt-1 mb-4 text-[30px] leading-none font-bold tracking-[-0.03em]">
        {t(`nav.${title}`)}
      </h1>
      <EmptyState title={t('placeholder.title')} text={t('placeholder.text')} />
    </>
  );
}
