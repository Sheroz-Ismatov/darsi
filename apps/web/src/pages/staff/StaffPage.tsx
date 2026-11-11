import type { InviteLinkResponse, StaffMemberDto, StaffStatus } from '@darsi/shared';
import {
  Avatar,
  Button,
  Card,
  Dialog,
  EmptyState,
  StatusBadge,
  Tag,
  type StatusTone,
} from '@darsi/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/layout/PageHeader';
import { useSchool } from '../../app/school';
import { InviteLinkDialog } from '../../features/invites/InviteLinkDialog';
import { errorText } from '../../lib/error-text';
import { formatDateTime } from '../../lib/format';
import { useIssueStaffInvite, useStaff, useUpdateStaff } from './staff-api';
import { StaffDialog } from './StaffDialog';

const TH = 'px-5 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase';
const TD = 'px-5 py-4 align-middle';

const STATUS = {
  active: { tone: 'ok', label: 'staff.statusActive' },
  invited: { tone: 'warn', label: 'staff.statusInvited' },
  deactivated: { tone: 'danger', label: 'staff.statusDeactivated' },
} as const satisfies Record<StaffStatus, { tone: StatusTone; label: string }>;

const ROLE = {
  owner: 'staff.roleOwner',
  admin: 'staff.roleAdmin',
  teacher: 'staff.roleTeacher',
} as const;

type Modal =
  | { kind: 'add' }
  | { kind: 'deactivate'; member: StaffMemberDto }
  | { kind: 'invite'; member: StaffMemberDto; invite: InviteLinkResponse };

/** W-12: staff list, invites, deactivation; owner only (TZ FR-10, FR-6). */
export function StaffPage() {
  const { t } = useTranslation();
  const staff = useStaff();
  const timeZone = useSchool().data?.timezone;
  const updateStaff = useUpdateStaff();
  const issueInvite = useIssueStaffInvite();
  const [modal, setModal] = useState<Modal | null>(null);
  const close = () => setModal(null);
  const formatDate = (iso: string) => formatDateTime(iso, timeZone);

  const actionError = updateStaff.error ?? issueInvite.error;
  const members = staff.data?.items ?? [];
  const limit = staff.data?.limit;

  const resetActions = () => {
    updateStaff.reset();
    issueInvite.reset();
  };

  const requestInvite = (member: StaffMemberDto) => {
    resetActions();
    issueInvite.mutate(member.id, {
      onSuccess: (invite) => setModal({ kind: 'invite', member, invite }),
    });
  };

  const setStatus = (member: StaffMemberDto, status: 'active' | 'deactivated') => {
    resetActions();
    updateStaff.mutate({ id: member.id, status }, { onSuccess: close });
  };

  const onlyOwner = members.every((member) => member.role === 'owner');
  const table = members.length > 0 && (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className={TH}>{t('staff.colName')}</th>
            <th className={TH}>{t('staff.colPhone')}</th>
            <th className={TH}>{t('staff.colRole')}</th>
            <th className={TH}>{t('staff.colStatus')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const status = STATUS[member.status];
            return (
              <tr key={member.id} className="border-b border-hairline last:border-b-0">
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Avatar name={member.displayName} size={36} />
                    <div className="font-bold">
                      {member.displayName}
                      {member.isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-muted">
                          ({t('staff.you')})
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className={`${TD} font-mono text-[13px] whitespace-nowrap text-ink-2`}>
                  {member.phone ?? '—'}
                </td>
                <td className={TD}>
                  <Tag>{t(ROLE[member.role])}</Tag>
                </td>
                <td className={TD}>
                  <StatusBadge tone={status.tone} dot>
                    {t(status.label)}
                  </StatusBadge>
                  {member.status === 'invited' && (
                    <div className="mt-1 text-xs text-muted">
                      {member.inviteExpiresAt
                        ? t('staff.inviteUntil', { date: formatDate(member.inviteExpiresAt) })
                        : t('staff.noInvite')}
                    </div>
                  )}
                </td>
                <td className={TD}>
                  {member.role !== 'owner' && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {member.status === 'invited' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={issueInvite.isPending}
                          onClick={() => requestInvite(member)}
                        >
                          {t('staff.invite')}
                        </Button>
                      )}
                      {member.status === 'deactivated' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateStaff.isPending}
                          onClick={() => setStatus(member, 'active')}
                        >
                          {t('staff.reactivate')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            resetActions();
                            setModal({ kind: 'deactivate', member });
                          }}
                        >
                          {t('staff.deactivate')}
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );

  return (
    <>
      <PageHeader
        eyebrow={t('staff.eyebrow')}
        title={t('nav.staff')}
        actions={
          <>
            {limit && (
              <span className="font-mono text-[13px] text-muted">
                {t('staff.seats', { used: limit.used, max: limit.max })}
              </span>
            )}
            <Button
              variant="lime"
              onClick={() => {
                resetActions();
                setModal({ kind: 'add' });
              }}
            >
              <Plus size={18} aria-hidden />
              {t('staff.add')}
            </Button>
          </>
        }
      />

      {actionError && modal === null && (
        <div role="alert" className="mb-4 text-[13px] font-semibold text-danger">
          {errorText(actionError)}
        </div>
      )}

      {staff.isPending ? (
        <div className="text-muted">{t('common.loading')}</div>
      ) : staff.isError ? (
        <EmptyState
          title={errorText(staff.error)}
          action={
            <Button variant="ghost" onClick={() => void staff.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <>
          {table}
          {onlyOwner && (
            <EmptyState className="mt-4" title={t('staff.empty')} text={t('staff.emptyText')} />
          )}
        </>
      )}

      {modal?.kind === 'add' && <StaffDialog onClose={close} />}
      {modal?.kind === 'invite' && (
        <InviteLinkDialog
          title={t('inviteLink.staffTitle')}
          text={t('inviteLink.staffText', {
            name: modal.member.displayName,
            date: formatDate(modal.invite.expiresAt),
          })}
          invite={modal.invite}
          onClose={close}
        />
      )}
      {modal?.kind === 'deactivate' && (
        <Dialog
          open
          onClose={close}
          title={t('staff.deactivateTitle', { name: modal.member.displayName })}
          closeLabel={t('staff.close')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={updateStaff.isPending}
                onClick={() => setStatus(modal.member, 'deactivated')}
              >
                {t('staff.deactivate')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-ink-2">{t('staff.deactivateText')}</p>
          {updateStaff.isError && (
            <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
              {errorText(updateStaff.error)}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
