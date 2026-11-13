import { STUDENTS_PAGE_SIZE, todayIn, type StudentListItemDto } from '@darsi/shared';
import {
  Avatar,
  Button,
  Card,
  Chip,
  cn,
  EmptyState,
  Input,
  PASTEL_BG,
  Select,
  StatusBadge,
  Tag,
} from '@darsi/ui';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '../../app/layout/PageHeader';
import { useSchool } from '../../app/school';
import { useCourses } from '../../features/courses/courses-api';
import { ageOn, fullName } from '../../features/students/student-format';
import { StudentDialog } from '../../features/students/StudentDialog';
import { useStudents } from '../../features/students/students-api';
import { errorText } from '../../lib/error-text';

const TH = 'px-5 py-3 text-left text-xs font-semibold tracking-wide text-muted uppercase';
const TD = 'px-5 py-4 align-middle';
/** FR-19: the request goes out once typing stops. */
const SEARCH_DELAY_MS = 300;

/** Filters live in the address, so the list comes back as it was after a student's card. */
function useListParams() {
  const [params, setParams] = useSearchParams();
  const state = {
    search: params.get('q') ?? '',
    course: params.get('course') ?? '',
    group: params.get('group') ?? '',
    archived: params.get('archived') === '1',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
  const update = (patch: Partial<typeof state>) => {
    const next = { ...state, page: 1, ...patch };
    const search = new URLSearchParams();
    if (next.search) search.set('q', next.search);
    if (next.course) search.set('course', next.course);
    if (next.group) search.set('group', next.group);
    if (next.archived) search.set('archived', '1');
    if (next.page > 1) search.set('page', String(next.page));
    setParams(search, { replace: true });
  };
  return [state, update] as const;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  const { t } = useTranslation();
  return (
    <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
      {label}
      <Select
        className="py-2.5"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t('students.all')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function StudentRow({
  student,
  today,
  onOpen,
}: {
  student: StudentListItemDto;
  today: string | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const name = fullName(student);
  const [guardian, ...others] = student.guardians;
  return (
    <tr
      className="cursor-pointer border-b border-hairline transition last:border-b-0 hover:bg-bg"
      onClick={onOpen}
    >
      <td className={TD}>
        <div className="flex items-center gap-3">
          <Avatar name={name} size={36} />
          <div className="min-w-0">
            <a
              href={`/students/${student.id}`}
              className="font-bold text-ink no-underline"
              onClick={(event) => {
                event.preventDefault();
                onOpen();
              }}
            >
              {name}
            </a>
            <div className="text-xs text-muted">
              {student.birthDate && today
                ? t('students.age', { n: ageOn(student.birthDate, today) })
                : t('students.noAge')}
            </div>
            {student.createdBy === 'parent' && (
              <Tag className="mt-1 py-0.5">{t('students.byParent')}</Tag>
            )}
          </div>
        </div>
      </td>
      <td className={TD}>
        {guardian ? (
          <div>
            <div className="text-sm font-semibold">
              {guardian.name}
              {others.length > 0 && <span className="ml-1 text-muted">+{others.length}</span>}
            </div>
            <div className="font-mono text-[13px] text-ink-2">{guardian.phone ?? '—'}</div>
            <StatusBadge className="mt-1" tone={guardian.joined ? 'ok' : 'warn'} dot>
              {t(guardian.joined ? 'students.inTelegram' : 'students.notLinked')}
            </StatusBadge>
          </div>
        ) : (
          <span className="text-sm text-muted">{t('students.noParent')}</span>
        )}
      </td>
      <td className={TD}>
        {student.groups.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {student.groups.map((group) => (
              <Tag
                key={group.enrollmentId}
                className={cn('border-transparent', PASTEL_BG[group.courseColor])}
              >
                {group.name}
              </Tag>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted">{t('students.noGroups')}</span>
        )}
      </td>
    </tr>
  );
}

/** W-6: students with search, course and group filters and the archive (TZ FR-19). */
export function StudentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timeZone = useSchool().data?.timezone;
  const today = timeZone ? todayIn(timeZone, new Date()) : null;
  const [state, update] = useListParams();
  const [typed, setTyped] = useState(state.search);
  const [adding, setAdding] = useState(false);
  const courses = useCourses(false);

  useEffect(() => {
    if (typed.trim() === state.search) return;
    const timer = setTimeout(() => update({ search: typed.trim() }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `update` is rebuilt on every render; only the typed text restarts the timer.
  }, [typed, state.search]);

  const students = useStudents({
    search: state.search,
    courseId: state.course,
    groupId: state.group,
    archived: state.archived,
    page: state.page,
  });

  const groupOptions = useMemo(() => {
    const all = courses.data ?? [];
    const pick = state.course ? all.filter((course) => course.id === state.course) : all;
    return pick.flatMap((course) =>
      course.groups
        .filter((group) => !group.archived)
        .map((group) => ({ id: group.id, label: `${course.name} · ${group.name}` })),
    );
  }, [courses.data, state.course]);

  const data = students.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / STUDENTS_PAGE_SIZE)) : 1;
  const filtered = Boolean(state.search || state.course || state.group);

  const emptyState = state.archived ? (
    <EmptyState title={t('students.archiveEmpty')} text={t('students.archiveEmptyText')} />
  ) : filtered ? (
    <EmptyState title={t('students.notFound')} text={t('students.notFoundText')} />
  ) : (
    <EmptyState
      title={t('students.empty')}
      text={t('students.emptyText')}
      action={
        <Button variant="lime" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden />
          {t('students.add')}
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader
        eyebrow={t('students.eyebrow')}
        title={state.archived ? t('students.archiveTitle') : t('nav.students')}
        actions={
          <>
            <Chip active={state.archived} onClick={() => update({ archived: !state.archived })}>
              {t('students.archive')}
            </Chip>
            <Button variant="lime" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden />
              {t('students.add')}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-[2] flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
          {t('students.searchLabel')}
          <span className="relative">
            <Search
              size={18}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              className="py-2.5 pl-11"
              value={typed}
              placeholder={t('students.searchPlaceholder')}
              onChange={(event) => setTyped(event.target.value)}
            />
          </span>
        </label>
        <FilterSelect
          label={t('students.filterCourse')}
          value={state.course}
          onChange={(course) => update({ course, group: '' })}
          options={(courses.data ?? []).map((course) => ({ id: course.id, label: course.name }))}
        />
        <FilterSelect
          label={t('students.filterGroup')}
          value={state.group}
          onChange={(group) => update({ group })}
          options={groupOptions}
        />
      </div>

      {students.isPending ? (
        <div className="text-muted">{t('common.loading')}</div>
      ) : students.isError ? (
        <EmptyState
          title={errorText(students.error)}
          action={
            <Button variant="ghost" onClick={() => void students.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div
          aria-busy={students.isPlaceholderData}
          className={cn(students.isPlaceholderData && 'opacity-50')}
        >
          <div className="mb-3 font-mono text-[13px] text-muted">
            {t('students.found', { n: data?.total ?? 0 })}
          </div>
          {data && data.items.length > 0 ? (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={TH}>{t('students.colStudent')}</th>
                    <th className={TH}>{t('students.colParent')}</th>
                    <th className={TH}>{t('students.colGroups')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((student) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      today={today}
                      onOpen={() => void navigate(`/students/${student.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            emptyState
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={state.page <= 1}
                onClick={() => update({ page: state.page - 1 })}
              >
                <ChevronLeft size={16} aria-hidden />
                {t('students.prevPage')}
              </Button>
              <span className="font-mono text-[13px] text-muted">
                {t('students.pageOf', { page: state.page, pages })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={state.page >= pages}
                onClick={() => update({ page: state.page + 1 })}
              >
                {t('students.nextPage')}
                <ChevronRight size={16} aria-hidden />
              </Button>
            </div>
          )}
        </div>
      )}

      {adding && <StudentDialog onClose={() => setAdding(false)} />}
    </>
  );
}
