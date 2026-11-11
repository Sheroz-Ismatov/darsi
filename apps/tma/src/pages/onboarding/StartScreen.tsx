import { parseStartPayload, type JoinSchoolResponse } from '@darsi/shared';
import { Button } from '@darsi/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../app/api';
import { homePath, useRefreshSession, useSession } from '../../app/session';
import { launchParam } from '../../app/telegram';
import { StatusScreen } from './StatusScreen';

const JOIN_ERROR_KEY = {
  SCHOOL_NOT_FOUND: 'invite.joinNotFound',
  SCHOOL_BLOCKED: 'invite.errorBlocked',
  MEMBERSHIP_DEACTIVATED: 'invite.joinDeactivated',
} as const;

function joinErrorKey(error: unknown) {
  if (error instanceof ApiError && error.code in JOIN_ERROR_KEY) {
    return JOIN_ERROR_KEY[error.code as keyof typeof JOIN_ERROR_KEY];
  }
  return 'invite.errorUnknown';
}

/** The school's public link (t.me/<bot>?start=<code>) makes the user a parent there (TZ FR-9). */
function JoinSchool({ code }: { code: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useSession();
  const refreshSession = useRefreshSession();
  const join = useQuery({
    queryKey: ['join', code],
    queryFn: async () => {
      const result = await apiFetch<JoinSchoolResponse>(`/schools/by-code/${code}/join`, {
        method: 'POST',
      });
      await refreshSession();
      return result;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (join.isPending) return <StatusScreen title={t('invite.joinLoading')} />;
  if (join.isError) {
    const key = joinErrorKey(join.error);
    return (
      <StatusScreen title={t('invite.joinErrorTitle')} text={t(key)}>
        {key === 'invite.errorUnknown' && (
          <Button block onClick={() => void join.refetch()}>
            {t('common.retry')}
          </Button>
        )}
        <Button
          variant="ghost"
          block
          onClick={() => void navigate(homePath(me), { replace: true })}
        >
          {t('invite.toHome')}
        </Button>
      </StatusScreen>
    );
  }
  return <Navigate to="/parent" replace />;
}

/** Entry route: acts on the launch payload once, then leaves for the home screen of the role. */
export function StartScreen() {
  const me = useSession();
  const start = parseStartPayload(launchParam());
  if (start?.kind === 'invite') return <Navigate to="/invite" replace />;
  if (start?.kind === 'school') return <JoinSchool code={start.code} />;
  return <Navigate to={homePath(me)} replace />;
}
