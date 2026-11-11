import { parseStartPayload, type AcceptInviteResponse, type Role } from '@darsi/shared';
import { Button, Card } from '@darsi/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../app/api';
import { homePath, useRefreshSession, useSession } from '../../app/session';
import { launchParam, openExternal } from '../../app/telegram';
import { StatusScreen } from './StatusScreen';

const ROLE_KEY = {
  owner: 'invite.roleOwner',
  admin: 'invite.roleAdmin',
  teacher: 'invite.roleTeacher',
  parent: 'invite.roleParent',
} as const satisfies Record<Role, string>;

const ERROR_KEY = {
  INVITE_USED: 'invite.errorUsed',
  INVITE_EXPIRED: 'invite.errorExpired',
  INVITE_NOT_FOUND: 'invite.errorNotFound',
  SCHOOL_BLOCKED: 'invite.errorBlocked',
} as const;

function errorKey(
  error: unknown,
): (typeof ERROR_KEY)[keyof typeof ERROR_KEY] | 'invite.errorUnknown' {
  if (error instanceof ApiError && error.code in ERROR_KEY) {
    return ERROR_KEY[error.code as keyof typeof ERROR_KEY];
  }
  return 'invite.errorUnknown';
}

function AcceptInvite({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useSession();
  const refreshSession = useRefreshSession();
  // A query, not an effect: the request goes out once even under StrictMode's double render.
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: async () => {
      const result = await apiFetch<AcceptInviteResponse>('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      await refreshSession();
      return result;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  if (invite.isPending) return <StatusScreen title={t('invite.loading')} />;

  if (invite.isError) {
    const key = errorKey(invite.error);
    return (
      <StatusScreen
        title={t('invite.errorTitle')}
        text={key === 'invite.errorUnknown' ? t(key) : `${t(key)} ${t('invite.askNewLink')}`}
      >
        {key === 'invite.errorUnknown' ? (
          <Button block onClick={() => void invite.refetch()}>
            {t('common.retry')}
          </Button>
        ) : (
          // Not "/": the entry route would send the user straight back here.
          <Button
            variant="ghost"
            block
            onClick={() => void navigate(homePath(me), { replace: true })}
          >
            {t('invite.toHome')}
          </Button>
        )}
      </StatusScreen>
    );
  }

  const { membership, webUrl } = invite.data;
  const isStaffWeb = membership.role === 'owner' || membership.role === 'admin';
  const next = membership.role === 'teacher' ? '/teacher' : '/parent';

  return (
    <StatusScreen
      title={t('invite.acceptedTitle')}
      text={isStaffWeb ? t('invite.panelHint') : undefined}
    >
      <Card className="text-left">
        <div className="text-xs text-muted">{t('invite.school')}</div>
        <div className="mb-3 font-bold">{membership.schoolName}</div>
        <div className="text-xs text-muted">{t('invite.role')}</div>
        <div className="font-bold">{t(ROLE_KEY[membership.role])}</div>
      </Card>
      {isStaffWeb && webUrl && (
        <Button variant="lime" block onClick={() => openExternal(webUrl)}>
          {t('invite.openPanel')}
        </Button>
      )}
      <Button
        variant={isStaffWeb ? 'ghost' : 'lime'}
        block
        onClick={() => void navigate(next, { replace: true })}
      >
        {t(membership.role === 'teacher' ? 'invite.toSchedule' : 'invite.continue')}
      </Button>
    </StatusScreen>
  );
}

/** Opened from t.me/<bot>?start=inv_<token>: the only place where invites are accepted. */
export function InviteScreen() {
  const start = parseStartPayload(launchParam());
  if (start?.kind !== 'invite') return <Navigate to="/" replace />;
  return <AcceptInvite token={start.token} />;
}
