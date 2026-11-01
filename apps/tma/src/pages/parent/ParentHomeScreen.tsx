import { EmptyState, Eyebrow } from '@darsi/ui';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../app/session';

// TODO(T-32): children cards with subscription balance and the next lesson.
export function ParentHomeScreen() {
  const { t } = useTranslation();
  const { user, memberships } = useSession();
  const school = memberships[0]?.schoolName;

  return (
    <>
      {school && <Eyebrow>{school}</Eyebrow>}
      <h1 className="mt-1 mb-4 text-[32px] leading-none font-bold tracking-[-0.03em]">
        {t('tma.greeting', { name: user.firstName })}
      </h1>
      <EmptyState title={t('placeholder.title')} text={t('placeholder.text')} />
    </>
  );
}
