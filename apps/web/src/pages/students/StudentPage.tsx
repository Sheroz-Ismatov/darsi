import {
  todayIn,
  type EnrollmentDto,
  type InviteLinkResponse,
  type StudentDetailDto,
  type StudentGuardianDetailDto,
} from '@darsi/shared';
import {
  Avatar,
  Button,
  Card,
  cn,
  Dialog,
  EmptyState,
  Eyebrow,
  PASTEL_BG,
  Segmented,
  StatusBadge,
  Tag,
} from '@darsi/ui';
import { ArrowLeft, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { SECTION_PATH } from '../../app/auth/access';
import { useSchool } from '../../app/school';
import { InviteLinkDialog } from '../../features/invites/InviteLinkDialog';
import { EnrollDialog, type TransferSource } from '../../features/students/EnrollDialog';
import { GuardianDialog } from '../../features/students/GuardianDialog';
import { LeaveDialog } from '../../features/students/LeaveDialog';
import { ageOn, fullName, RELATION_LABEL } from '../../features/students/student-format';
import { StudentDialog, type StudentCreatedState } from '../../features/students/StudentDialog';
import {
  useArchiveStudent,
  useIssueGuardianInvite,
  useRemoveGuardian,
  useStudent,
} from '../../features/students/students-api';
import { errorText } from '../../lib/error-text';
import { formatDateTime, formatDay } from '../../lib/format';

type Tab = 'data' | 'groups' | 'subscriptions' | 'attendance' | 'payments';

type Modal =
  | { kind: 'edit' }
  | { kind: 'archive' }
  | { kind: 'guardian' }
  | { kind: 'unlink'; guardian: StudentGuardianDetailDto }
  | { kind: 'invite'; guardian: StudentGuardianDetailDto; invite: InviteLinkResponse }
  | { kind: 'enroll' }
  | { kind: 'transfer'; from: TransferSource }
  | { kind: 'leave'; enrollment: EnrollmentDto };

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={SECTION_PATH.students}
      className="mb-4 inline-flex items-center gap-2 text-sm font-semibold underline decoration-lime decoration-[3px] underline-offset-4"
    >
      <ArrowLeft size={16} aria-hidden />
      {t('students.back')}
    </Link>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
      {errorText(error)}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-hairline py-3 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold break-words whitespace-pre-line">{value}</span>
    </div>
  );
}

/** Tab 1: the student's data and parents with their Telegram links (TZ FR-17, FR-20). */
function DataTab({
  student,
  timeZone,
  onModal,
}: {
  student: StudentDetailDto;
  timeZone: string | undefined;
  onModal: (modal: Modal) => void;
}) {
  const { t } = useTranslation();
  const issueInvite = useIssueGuardianInvite();
  const requestInvite = (guardian: StudentGuardianDetailDto) =>
    issueInvite.mutate(
      { studentId: student.id, guardianId: guardian.id },
      { onSuccess: (invite) => onModal({ kind: 'invite', guardian, invite }) },
    );

  return (
    <div className="grid grid-cols-[1fr_1.4fr] gap-4 max-[900px]:grid-cols-1">
      <Card>
        <Eyebrow className="mb-2">{t('students.dataTitle')}</Eyebrow>
        <DataRow
          label={t('students.birthDate')}
          value={student.birthDate ? formatDay(student.birthDate) : t('students.noValue')}
        />
        <DataRow label={t('students.comment')} value={student.comment ?? t('students.noValue')} />
        <DataRow
          label={t('students.createdBy')}
          value={t(
            student.createdBy === 'parent' ? 'students.createdByParent' : 'students.createdByAdmin',
          )}
        />
      </Card>
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="mb-0">{t('students.guardiansTitle')}</Eyebrow>
          <Button variant="ghost" size="sm" onClick={() => onModal({ kind: 'guardian' })}>
            <Plus size={16} aria-hidden />
            {t('students.addGuardian')}
          </Button>
        </div>
        {student.guardians.length === 0 && (
          <div className="py-3 text-sm text-muted">{t('students.noGuardians')}</div>
        )}
        {student.guardians.map((guardian) => (
          <div
            key={guardian.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-3 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={guardian.name} size={36} />
              <div className="min-w-0">
                <div className="font-bold">
                  {guardian.name}
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    {t(RELATION_LABEL[guardian.relation])}
                  </span>
                </div>
                <div className="font-mono text-[13px] text-ink-2">{guardian.phone ?? '—'}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={guardian.joined ? 'ok' : 'warn'} dot>
                    {t(guardian.joined ? 'students.inTelegram' : 'students.notLinked')}
                  </StatusBadge>
                  {!guardian.joined && (
                    <span className="text-xs text-muted">
                      {guardian.inviteExpiresAt
                        ? t('students.inviteUntil', {
                            date: formatDateTime(guardian.inviteExpiresAt, timeZone),
                          })
                        : t('students.noInvite')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!guardian.joined && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={issueInvite.isPending}
                  onClick={() => requestInvite(guardian)}
                >
                  {t('students.inviteLink')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onModal({ kind: 'unlink', guardian })}
              >
                {t('students.unlink')}
              </Button>
            </div>
          </div>
        ))}
        {issueInvite.isError && <ErrorLine error={issueInvite.error} />}
      </Card>
    </div>
  );
}

function EnrollmentLine({
  enrollment,
  children,
}: {
  enrollment: EnrollmentDto;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn('size-9 shrink-0 rounded-md', PASTEL_BG[enrollment.course.color])}
        />
        <div className="min-w-0">
          <Link to={`/groups/${enrollment.group.id}`} className="font-bold text-ink">
            {enrollment.group.name}
          </Link>
          <div className="text-xs text-muted">
            {enrollment.course.name} ·{' '}
            {enrollment.leftOn
              ? t('students.period', {
                  from: formatDay(enrollment.enrolledOn),
                  to: formatDay(enrollment.leftOn),
                })
              : t('students.enrolledOn', { date: formatDay(enrollment.enrolledOn) })}
          </div>
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Tab 2: active enrollments with transfer and leave, then the history (TZ FR-21). */
function GroupsTab({
  student,
  onModal,
}: {
  student: StudentDetailDto;
  onModal: (modal: Modal) => void;
}) {
  const { t } = useTranslation();
  const active = student.enrollments.filter((enrollment) => enrollment.status === 'active');
  const history = student.enrollments.filter((enrollment) => enrollment.status === 'left');
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="mb-0">{t('students.groupsTitle')}</Eyebrow>
          {!student.archived && (
            <Button variant="ghost" size="sm" onClick={() => onModal({ kind: 'enroll' })}>
              <Plus size={16} aria-hidden />
              {t('students.enroll')}
            </Button>
          )}
        </div>
        {active.length === 0 && (
          <div className="py-3 text-sm text-muted">{t('students.noActiveGroups')}</div>
        )}
        {active.map((enrollment) => (
          <EnrollmentLine key={enrollment.id} enrollment={enrollment}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onModal({
                  kind: 'transfer',
                  from: { enrollmentId: enrollment.id, groupName: enrollment.group.name },
                })
              }
            >
              {t('students.transfer')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onModal({ kind: 'leave', enrollment })}
            >
              {t('students.leave')}
            </Button>
          </EnrollmentLine>
        ))}
      </Card>
      {history.length > 0 && (
        <Card>
          <Eyebrow className="mb-2">{t('students.historyTitle')}</Eyebrow>
          {history.map((enrollment) => (
            <EnrollmentLine key={enrollment.id} enrollment={enrollment} />
          ))}
        </Card>
      )}
    </div>
  );
}

/** W-7: the student's card with tabs (TZ FR-20). */
export function StudentPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const location = useLocation();
  const created = location.state as StudentCreatedState | null;
  const student = useStudent(id);
  const timeZone = useSchool().data?.timezone;
  const archiveStudent = useArchiveStudent();
  const removeGuardian = useRemoveGuardian();
  const [tab, setTab] = useState<Tab>('data');
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState<string | null>(
    created?.guardianReused ? t('students.guardianReused') : null,
  );
  const close = () => setModal(null);

  if (student.isPending) return <div className="text-muted">{t('common.loading')}</div>;
  if (student.isError) {
    return (
      <>
        <BackLink />
        <EmptyState title={t('errors.STUDENT_NOT_FOUND')} text={errorText(student.error)} />
      </>
    );
  }

  const s = student.data;
  const name = fullName(s);
  const today = timeZone ? todayIn(timeZone, new Date()) : null;
  const soon = (title: string) => <EmptyState title={title} text={t('students.soonText')} />;

  return (
    <>
      <BackLink />
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} size={64} />
          <div className="min-w-0">
            <h1 className="m-0 text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-balance max-[800px]:text-[30px]">
              {name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              {s.birthDate && today
                ? t('students.age', { n: ageOn(s.birthDate, today) })
                : t('students.noAge')}
              {s.archived && <Tag>{t('students.archived')}</Tag>}
              {s.createdBy === 'parent' && <Tag>{t('students.byParent')}</Tag>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setModal({ kind: 'edit' })}>
            {t('students.edit')}
          </Button>
          {s.archived ? (
            <Button
              variant="ghost"
              disabled={archiveStudent.isPending}
              onClick={() => archiveStudent.mutate({ id: s.id, archived: false })}
            >
              {t('students.fromArchive')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setModal({ kind: 'archive' })}>
              {t('students.toArchive')}
            </Button>
          )}
        </div>
      </Card>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-md bg-ok-bg px-4 py-3 text-sm font-semibold text-ok"
        >
          {notice}
        </div>
      )}
      {archiveStudent.isError && modal === null && <ErrorLine error={archiveStudent.error} />}

      <Segmented
        // Five tabs do not fit a narrow window: they scroll instead of wrapping out of the pill.
        className="mb-4 max-w-3xl overflow-x-auto [&>button]:whitespace-nowrap"
        label={t('students.tabsLabel')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'data', label: t('students.tabData') },
          { value: 'groups', label: t('students.tabGroups') },
          { value: 'subscriptions', label: t('students.tabSubscriptions') },
          { value: 'attendance', label: t('students.tabAttendance') },
          { value: 'payments', label: t('students.tabPayments') },
        ]}
      />

      {tab === 'data' && <DataTab student={s} timeZone={timeZone} onModal={setModal} />}
      {tab === 'groups' && <GroupsTab student={s} onModal={setModal} />}
      {/* TODO(T-20): the student's subscriptions. */}
      {tab === 'subscriptions' && soon(t('students.soonSubscriptions'))}
      {/* TODO(T-22): the student's attendance. */}
      {tab === 'attendance' && soon(t('students.soonAttendance'))}
      {/* TODO(T-25): the student's payments and balance. */}
      {tab === 'payments' && soon(t('students.soonPayments'))}

      {modal?.kind === 'edit' && <StudentDialog student={s} onClose={close} />}
      {modal?.kind === 'guardian' && (
        <GuardianDialog
          studentId={s.id}
          onClose={close}
          onDone={(reused) => {
            setNotice(reused ? t('students.guardianReused') : null);
            close();
          }}
        />
      )}
      {modal?.kind === 'invite' && (
        <InviteLinkDialog
          title={t('inviteLink.parentTitle')}
          text={t('inviteLink.parentText', {
            name: modal.guardian.name,
            date: formatDateTime(modal.invite.expiresAt, timeZone),
          })}
          invite={modal.invite}
          onClose={close}
        />
      )}
      {modal?.kind === 'unlink' && (
        <Dialog
          open
          onClose={close}
          title={t('students.unlinkTitle', { name: modal.guardian.name })}
          closeLabel={t('students.close')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={removeGuardian.isPending}
                onClick={() =>
                  removeGuardian.mutate(
                    { studentId: s.id, guardianId: modal.guardian.id },
                    { onSuccess: close },
                  )
                }
              >
                {t('students.unlink')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-ink-2">{t('students.unlinkText')}</p>
          {removeGuardian.isError && <ErrorLine error={removeGuardian.error} />}
        </Dialog>
      )}
      {modal?.kind === 'archive' && (
        <Dialog
          open
          onClose={close}
          title={t('students.archiveTitleConfirm', { name })}
          closeLabel={t('students.close')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={archiveStudent.isPending}
                onClick={() =>
                  archiveStudent.mutate({ id: s.id, archived: true }, { onSuccess: close })
                }
              >
                {t('students.toArchive')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-ink-2">{t('students.archiveText')}</p>
          {archiveStudent.isError && <ErrorLine error={archiveStudent.error} />}
        </Dialog>
      )}
      {(modal?.kind === 'enroll' || modal?.kind === 'transfer') && (
        <EnrollDialog
          studentId={s.id}
          studentName={name}
          currentGroupIds={s.groups.map((group) => group.id)}
          from={modal.kind === 'transfer' ? modal.from : undefined}
          onClose={close}
        />
      )}
      {modal?.kind === 'leave' && (
        <LeaveDialog
          enrollmentId={modal.enrollment.id}
          groupName={modal.enrollment.group.name}
          enrolledOn={modal.enrollment.enrolledOn}
          onClose={close}
        />
      )}
    </>
  );
}
