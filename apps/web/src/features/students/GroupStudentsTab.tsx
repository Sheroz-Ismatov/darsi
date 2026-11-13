import { STUDENTS_PAGE_SIZE, type GroupDto, type GroupFullDetails } from '@darsi/shared';
import { Avatar, Button, Card, EmptyState, Field, Input } from '@darsi/ui';
import { ChevronLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { LeaveDialog } from './LeaveDialog';
import { fullName } from './student-format';
import { useEnroll, useStudents } from './students-api';

const SEARCH_DELAY_MS = 300;
const SEARCH_MIN_LENGTH = 2;

/** Search among the school's students and enroll the one picked into this group. */
function AddStudentPanel({ group, onClose }: { group: GroupDto; onClose: () => void }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const enroll = useEnroll();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const found = useStudents({ search }, { enabled: search.length >= SEARCH_MIN_LENGTH });
  const full =
    enroll.error instanceof ApiError && enroll.error.code === 'GROUP_FULL'
      ? (enroll.error.details as unknown as GroupFullDetails)
      : null;

  const pick = (studentId: string, force: boolean) => {
    setPending(studentId);
    enroll.mutate({ studentId, groupId: group.id, force }, { onSuccess: () => setPending(null) });
  };

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-bold">{t('students.groupSearchTitle')}</div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('students.close')}
        </Button>
      </div>
      <Field
        label={t('students.groupSearchLabel')}
        htmlFor="group-student-search"
        hint={t('students.groupSearchHint')}
      >
        <Input
          id="group-student-search"
          type="search"
          autoFocus
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </Field>
      {found.data && search.length >= SEARCH_MIN_LENGTH && (
        <div>
          {found.data.items.length === 0 && (
            <div className="text-sm text-muted">{t('students.groupSearchEmpty')}</div>
          )}
          {found.data.items.map((student) => {
            const inGroup = student.groups.some((g) => g.id === group.id);
            return (
              <div
                key={student.id}
                className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={fullName(student)} size={32} />
                  <span className="font-semibold">{fullName(student)}</span>
                </div>
                {inGroup ? (
                  <span className="text-xs text-muted">{t('students.inGroup')}</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={enroll.isPending}
                    onClick={() => pick(student.id, false)}
                  >
                    {t('students.pick')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {full && pending ? (
        <div role="alert" className="mt-4 rounded-md bg-warn-bg p-4 text-warn">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} aria-hidden />
            {t('students.fullTitle')}
          </div>
          <div className="mb-3 text-sm">{t('students.fullText', { ...full })}</div>
          <Button size="sm" disabled={enroll.isPending} onClick={() => pick(pending, true)}>
            {t('students.force')}
          </Button>
        </div>
      ) : (
        enroll.isError && (
          <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {errorText(enroll.error)}
          </div>
        )
      )}
    </Card>
  );
}

/** W-5 "Students" tab: who is in the group now, adding and leaving (TZ FR-21). */
export function GroupStudentsTab({ group }: { group: GroupDto }) {
  const { t } = useTranslation();
  // A group holds up to 500 students; the list comes in pages of the student list.
  const [page, setPage] = useState(1);
  const students = useStudents({ groupId: group.id, page });
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState<{ enrollmentId: string } | null>(null);
  const items = students.data?.items ?? [];
  const pages = students.data
    ? Math.max(1, Math.ceil(students.data.total / STUDENTS_PAGE_SIZE))
    : 1;

  // Leaving the last student of the last page leaves that page empty: step back.
  useEffect(() => {
    if (students.data && !students.isPlaceholderData && page > pages) setPage(pages);
  }, [students.data, students.isPlaceholderData, page, pages]);

  return (
    <>
      {!group.archived && !adding && (
        <div className="mb-4">
          <Button variant="lime" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden />
            {t('groups.addStudent')}
          </Button>
        </div>
      )}
      {adding && <AddStudentPanel group={group} onClose={() => setAdding(false)} />}

      {students.isPending ? (
        <div className="text-muted">{t('common.loading')}</div>
      ) : students.isError ? (
        <EmptyState title={errorText(students.error)} />
      ) : items.length === 0 ? (
        <EmptyState title={t('groups.studentsEmpty')} text={t('groups.studentsEmptyText')} />
      ) : (
        <Card className="p-0">
          {items.map((student) => {
            const enrollment = student.groups.find((g) => g.id === group.id);
            const guardian = student.guardians[0];
            return (
              <div
                key={student.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={fullName(student)} size={36} />
                  <div className="min-w-0">
                    <Link to={`/students/${student.id}`} className="font-bold text-ink">
                      {fullName(student)}
                    </Link>
                    {guardian && (
                      <div className="text-xs text-muted">
                        {guardian.name}
                        {guardian.phone && (
                          <span className="ml-1.5 font-mono">{guardian.phone}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {enrollment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeaving({ enrollmentId: enrollment.enrollmentId })}
                  >
                    {t('students.leave')}
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} aria-hidden />
            {t('students.prevPage')}
          </Button>
          <span className="font-mono text-[13px] text-muted">
            {t('students.pageOf', { page, pages })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('students.nextPage')}
            <ChevronRight size={16} aria-hidden />
          </Button>
        </div>
      )}

      {leaving && (
        <LeaveDialog
          enrollmentId={leaving.enrollmentId}
          groupName={group.name}
          onClose={() => setLeaving(null)}
        />
      )}
    </>
  );
}
