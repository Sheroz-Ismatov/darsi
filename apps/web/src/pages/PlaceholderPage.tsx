import { EmptyState } from '@darsi/ui';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../app/layout/PageHeader';
import type { Dictionary } from '@darsi/shared';

interface PlaceholderPageProps {
  title: keyof Dictionary['nav'];
}

/** Section that is not implemented yet; replaced task by task (IMPLEMENTATION_PLAN.md). */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(`nav.${title}`)} />
      <EmptyState title={t('placeholder.title')} text={t('placeholder.text')} />
    </>
  );
}
