import type { OwnerInviteResponse, PlanDto, PlatformSchoolDto } from '@darsi/shared';
import { Button, Card, Dialog, EmptyState, Input, KpiTile, Select, StatusBadge } from '@darsi/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/layout/PageHeader';
import { errorText } from '../../lib/error-text';
import { PlanDialog } from './PlanDialog';
import { useIssueOwnerInvite, usePlans, useSchools, useUpdateSchool } from './platform-api';
import { SchoolDialog } from './SchoolDialog';

const dateTime = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const formatDate = (iso: string): string => dateTime.format(new Date(iso));

type Modal =
  | { kind: 'school' }
  | { kind: 'plan'; plan: PlanDto | null }
  | { kind: 'block'; school: PlatformSchoolDto }
  | { kind: 'invite'; school: PlatformSchoolDto; invite: OwnerInviteResponse };

const TH = 'px-5 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase';
const TD = 'px-5 py-4 align-top';

function InviteDialog({
  school,
  invite,
  onClose,
}: {
  school: PlatformSchoolDto;
  invite: OwnerInviteResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(invite.url).then(() => setCopied(true));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('platform.inviteTitle')}
      closeLabel={t('platform.close')}
      footer={<Button onClick={onClose}>{t('platform.done')}</Button>}
    >
      <p className="mt-0 mb-4 text-ink-2">
        {t('platform.inviteText', { name: school.name, date: formatDate(invite.expiresAt) })}
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={invite.url}
          aria-label={t('platform.inviteTitle')}
          className="font-mono text-[13px]"
          onFocus={(event) => event.target.select()}
        />
        <Button variant="lime" className="shrink-0" onClick={copy}>
          {t(copied ? 'platform.copied' : 'platform.copy')}
        </Button>
      </div>
      <p className="mt-3 mb-0 text-xs text-muted">{t('platform.inviteOnce')}</p>
    </Dialog>
  );
}

/** W-14: schools, plans and limits, blocking, owner invite links (TZ FR-1, FR-6). */
export function PlatformPage() {
  const { t } = useTranslation();
  const schools = useSchools();
  const plans = usePlans();
  const updateSchool = useUpdateSchool();
  const issueInvite = useIssueOwnerInvite();
  const [modal, setModal] = useState<Modal | null>(null);
  const close = () => setModal(null);

  const actionError = updateSchool.error ?? issueInvite.error;
  const loadError = schools.error ?? plans.error;
  const list = schools.data ?? [];
  const planList = plans.data ?? [];

  const requestInvite = (school: PlatformSchoolDto) => {
    updateSchool.reset();
    issueInvite.mutate(school.id, {
      onSuccess: (invite) => setModal({ kind: 'invite', school, invite }),
    });
  };

  const setStatus = (school: PlatformSchoolDto, status: 'active' | 'blocked') => {
    issueInvite.reset();
    updateSchool.mutate({ id: school.id, status }, { onSuccess: close });
  };

  return (
    <>
      <PageHeader
        eyebrow={t('platform.eyebrow')}
        title={t('nav.platform')}
        actions={
          <Button
            variant="lime"
            disabled={planList.length === 0}
            onClick={() => setModal({ kind: 'school' })}
          >
            <Plus size={18} aria-hidden />
            {t('platform.newSchool')}
          </Button>
        }
      />

      {loadError && (
        <EmptyState
          className="mb-6"
          title={errorText(loadError)}
          action={
            <Button
              variant="ghost"
              onClick={() => {
                void schools.refetch();
                void plans.refetch();
              }}
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}

      <div className="mb-6 grid grid-cols-3 gap-4 max-[800px]:grid-cols-1">
        <KpiTile color="lime" label={t('platform.kpiSchools')} value={list.length} />
        <KpiTile
          color="mint"
          label={t('platform.kpiActive')}
          value={list.filter((s) => s.status === 'active').length}
        />
        <KpiTile
          color="butter"
          label={t('platform.kpiAwaitingOwner')}
          value={list.filter((s) => s.owner?.status !== 'active').length}
        />
      </div>

      {actionError && (
        <div role="alert" className="mb-4 text-[13px] font-semibold text-danger">
          {errorText(actionError)}
        </div>
      )}

      {schools.isPending ? (
        <div className="mb-10 text-muted">{t('common.loading')}</div>
      ) : list.length === 0 ? (
        !loadError && (
          <EmptyState
            className="mb-10"
            title={t('platform.empty')}
            text={t('platform.emptyText')}
          />
        )
      ) : (
        <Card className="mb-10 overflow-x-auto p-0">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className={TH}>{t('platform.colSchool')}</th>
                <th className={TH}>{t('platform.colOwner')}</th>
                <th className={TH}>{t('platform.colPlan')}</th>
                <th className={TH}>{t('platform.colStaff')}</th>
                <th className={TH}>{t('platform.colStatus')}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {list.map((school) => {
                const ownerJoined = school.owner?.status === 'active';
                return (
                  <tr key={school.id} className="border-b border-hairline last:border-b-0">
                    <td className={TD}>
                      <div className="font-bold">{school.name}</div>
                      <div className="mt-1 font-mono text-xs text-muted">
                        {school.code} · {school.currency} · {school.timezone}
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-2">
                        {school.owner?.displayName}
                        <StatusBadge tone={ownerJoined ? 'ok' : 'warn'} dot>
                          {t(ownerJoined ? 'platform.ownerActive' : 'platform.ownerInvited')}
                        </StatusBadge>
                      </div>
                      {!ownerJoined && (
                        <div className="mt-1 text-xs text-muted">
                          {school.ownerInviteExpiresAt
                            ? t('platform.inviteUntil', {
                                date: formatDate(school.ownerInviteExpiresAt),
                              })
                            : t('platform.noInvite')}
                        </div>
                      )}
                    </td>
                    <td className={TD}>
                      <Select
                        aria-label={t('platform.colPlan')}
                        value={school.plan.id}
                        disabled={updateSchool.isPending}
                        className="min-w-36 px-3 py-2 text-sm"
                        onChange={(event) => {
                          issueInvite.reset();
                          updateSchool.mutate({ id: school.id, planId: event.target.value });
                        }}
                      >
                        {planList.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className={`${TD} font-mono whitespace-nowrap`}>
                      {t('platform.staffOf', {
                        used: school.staffCount,
                        max: school.plan.maxStaff,
                      })}
                    </td>
                    <td className={TD}>
                      <StatusBadge tone={school.status === 'active' ? 'ok' : 'danger'}>
                        {t(
                          school.status === 'active'
                            ? 'platform.statusActive'
                            : 'platform.statusBlocked',
                        )}
                      </StatusBadge>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!ownerJoined && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={issueInvite.isPending}
                            onClick={() => requestInvite(school)}
                          >
                            {t('platform.issueInvite')}
                          </Button>
                        )}
                        {school.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setModal({ kind: 'block', school })}
                          >
                            {t('platform.block')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updateSchool.isPending}
                            onClick={() => setStatus(school, 'active')}
                          >
                            {t('platform.unblock')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <section>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">
            {t('platform.plansTitle')}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'plan', plan: null })}>
            <Plus size={16} aria-hidden />
            {t('platform.newPlan')}
          </Button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {planList.map((plan) => (
            <Card key={plan.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{plan.name}</div>
                  <div className="text-xs text-muted">
                    {t('platform.planSchools', { n: plan.schoolsCount })}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'plan', plan })}>
                  {t('platform.planEdit')}
                </Button>
              </div>
              <dl className="mt-4 mb-0 grid grid-cols-3 gap-2">
                {(
                  [
                    ['platform.planStudents', plan.maxStudents],
                    ['platform.planStaff', plan.maxStaff],
                    ['platform.planStorage', plan.maxStorageMb],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{t(label)}</dt>
                    <dd className="m-0 font-mono text-lg font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      </section>

      {modal?.kind === 'school' && <SchoolDialog plans={planList} onClose={close} />}
      {modal?.kind === 'plan' && <PlanDialog plan={modal.plan} onClose={close} />}
      {modal?.kind === 'invite' && (
        <InviteDialog school={modal.school} invite={modal.invite} onClose={close} />
      )}
      {modal?.kind === 'block' && (
        <Dialog
          open
          onClose={close}
          title={t('platform.blockTitle', { name: modal.school.name })}
          closeLabel={t('platform.close')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={updateSchool.isPending}
                onClick={() => setStatus(modal.school, 'blocked')}
              >
                {t('platform.block')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-ink-2">{t('platform.blockText')}</p>
        </Dialog>
      )}
    </>
  );
}
