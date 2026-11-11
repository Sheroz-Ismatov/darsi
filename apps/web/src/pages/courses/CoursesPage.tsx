import type { CourseDto } from '@darsi/shared';
import { Button, Chip, cn, Dialog, EmptyState, PASTEL_BG, ProgressBar, Tag } from '@darsi/ui';
import { Archive, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../../app/layout/PageHeader';
import { CourseIcon } from '../../features/courses/CourseIcon';
import { ageText, FORMAT_LABEL, KIND_LABEL } from '../../features/courses/course-labels';
import { useCourses, useDeleteCourse } from '../../features/courses/courses-api';
import { GroupDialog } from '../../features/courses/GroupDialog';
import { errorText } from '../../lib/error-text';
import { CourseDialog } from './CourseDialog';

type Modal =
  | { kind: 'course'; course?: CourseDto }
  | { kind: 'delete'; course: CourseDto }
  | { kind: 'group'; course: CourseDto };

/** Course header and its group cards (prototype TCourses). */
function CourseBlock({
  course,
  onEdit,
  onAddGroup,
}: {
  course: CourseDto;
  onEdit: () => void;
  onAddGroup: () => void;
}) {
  const { t } = useTranslation();
  const age = ageText(t, course.ageFrom, course.ageTo);
  const meta = [t(FORMAT_LABEL[course.format]), t(KIND_LABEL[course.kind]), age].filter(Boolean);

  return (
    // Not <Card>: its padding would frame the pastel header, and cn() does not merge classes.
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 p-[18px]',
          PASTEL_BG[course.color],
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <CourseIcon icon={course.icon} color={course.color} plain />
          <div className="min-w-0">
            <div className="text-[17px] font-bold tracking-[-0.01em]">{course.name}</div>
            <div className="text-[13px] text-ink-2">{meta.join(' · ')}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!course.showInCatalog && <Tag>{t('courses.hiddenFromCatalog')}</Tag>}
          {course.archived && <Tag>{t('courses.archived')}</Tag>}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {t('courses.edit')}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5 bg-bg p-3.5">
        {course.groups.map((group) => (
          <Link
            key={group.id}
            to={`/groups/${group.id}`}
            className={cn(
              'rounded-lg border border-hairline bg-surface p-3 text-left transition hover:border-ink',
              group.archived && 'opacity-60',
            )}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <span className="text-sm font-bold">{group.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {t('courses.seats', { used: group.enrolledCount, max: group.capacity })}
              </span>
            </div>
            <div className="truncate text-xs text-muted">
              {group.archived ? t('courses.archived') : group.teacherName}
            </div>
            <ProgressBar
              className="mt-2"
              value={group.enrolledCount}
              max={group.capacity}
              label={t('courses.seatsLabel', { used: group.enrolledCount, max: group.capacity })}
            />
          </Link>
        ))}
        {!course.archived && (
          <button
            type="button"
            onClick={onAddGroup}
            className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-hairline bg-transparent p-3 text-sm font-semibold text-ink-2 transition hover:border-ink hover:text-ink"
          >
            <Plus size={18} aria-hidden />
            {t('courses.addGroup')}
          </button>
        )}
      </div>
    </section>
  );
}

/** W-4: the course catalog with groups (TZ FR-11, FR-12). */
export function CoursesPage() {
  const { t } = useTranslation();
  const [archived, setArchived] = useState(false);
  const courses = useCourses(archived);
  const deleteCourse = useDeleteCourse();
  const [modal, setModal] = useState<Modal | null>(null);
  const close = () => setModal(null);

  const openNew = () => setModal({ kind: 'course' });
  const list = courses.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow={t('courses.eyebrow')}
        title={archived ? t('courses.archiveTitle') : t('nav.courses')}
        actions={
          <>
            <Chip active={archived} onClick={() => setArchived((value) => !value)}>
              <Archive size={16} aria-hidden />
              {t('courses.archive')}
            </Chip>
            <Button onClick={openNew}>
              <Plus size={18} aria-hidden />
              {t('courses.newCourse')}
            </Button>
          </>
        }
      />

      {courses.isPending ? (
        <div className="text-muted">{t('common.loading')}</div>
      ) : courses.isError ? (
        <EmptyState
          title={errorText(courses.error)}
          action={
            <Button variant="ghost" onClick={() => void courses.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : list.length === 0 ? (
        archived ? (
          <EmptyState title={t('courses.archiveEmpty')} text={t('courses.archiveEmptyText')} />
        ) : (
          <EmptyState
            title={t('courses.empty')}
            text={t('courses.emptyText')}
            action={
              <Button onClick={openNew}>
                <Plus size={18} aria-hidden />
                {t('courses.createFirst')}
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((course) => (
            <CourseBlock
              key={course.id}
              course={course}
              onEdit={() => setModal({ kind: 'course', course })}
              onAddGroup={() => setModal({ kind: 'group', course })}
            />
          ))}
        </div>
      )}

      {modal?.kind === 'course' && (
        <CourseDialog
          course={modal.course}
          onClose={close}
          onDelete={(course) => {
            deleteCourse.reset();
            setModal({ kind: 'delete', course });
          }}
        />
      )}
      {modal?.kind === 'group' && <GroupDialog course={modal.course} onClose={close} />}
      {modal?.kind === 'delete' && (
        <Dialog
          open
          onClose={close}
          title={t('courses.deleteTitle', { name: modal.course.name })}
          closeLabel={t('courses.close')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={deleteCourse.isPending}
                onClick={() => deleteCourse.mutate(modal.course.id, { onSuccess: close })}
              >
                {t('courses.delete')}
              </Button>
            </>
          }
        >
          <p className="m-0 text-ink-2">{t('courses.deleteText')}</p>
          {deleteCourse.isError && (
            <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
              {errorText(deleteCourse.error)}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
