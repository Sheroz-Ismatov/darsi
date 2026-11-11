import { Button, Card, EmptyState, Eyebrow, KpiTile, PastelCard, Segmented, Tag } from '@darsi/ui';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { SECTION_PATH } from '../../app/auth/access';
import { CourseIcon } from '../../features/courses/CourseIcon';
import { FORMAT_LABEL, KIND_LABEL } from '../../features/courses/course-labels';
import { useArchiveGroup, useGroup } from '../../features/courses/courses-api';
import { GroupDialog } from '../../features/courses/GroupDialog';
import { errorText } from '../../lib/error-text';
import { formatDay } from '../../lib/format';

type Tab = 'students' | 'schedule';

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      to={SECTION_PATH.courses}
      className="mb-4 inline-flex items-center gap-2 text-sm font-semibold underline decoration-lime decoration-[3px] underline-offset-4"
    >
      <ArrowLeft size={16} aria-hidden />
      {t('groups.back')}
    </Link>
  );
}

function MeetingLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Eyebrow className="mb-1">{t('groups.meeting')}</Eyebrow>
        <a href={url} target="_blank" rel="noreferrer" className="font-mono text-sm break-all">
          {url}
        </a>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(url).then(() => setCopied(true))}
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        {t(copied ? 'groups.copied' : 'groups.copy')}
      </Button>
    </Card>
  );
}

/** W-5: a group with its teacher, seats and (later) students and schedule (prototype TGroup). */
export function GroupPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const group = useGroup(id);
  const archiveGroup = useArchiveGroup();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('students');

  if (group.isPending) return <div className="text-muted">{t('common.loading')}</div>;
  if (group.isError) {
    return (
      <>
        <BackLink />
        <EmptyState title={t('groups.notFound')} text={errorText(group.error)} />
      </>
    );
  }

  const g = group.data;
  const { course } = g;
  const period = [
    g.startsOn && t('groups.periodFrom', { date: formatDay(g.startsOn) }),
    g.endsOn && t('groups.periodTo', { date: formatDay(g.endsOn) }),
  ].filter(Boolean);

  return (
    <>
      <BackLink />
      <PastelCard
        color={course.color}
        className="mb-4 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex min-w-0 items-center gap-4">
          <CourseIcon icon={course.icon} color={course.color} size={56} plain />
          <div className="min-w-0">
            <Eyebrow className="mb-0 text-ink/70">
              {t('groups.courseLabel', { name: course.name })}
            </Eyebrow>
            <h1 className="mt-1.5 mb-0 text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-balance max-[800px]:text-[30px]">
              {g.name}
            </h1>
            {(g.archived || course.archived) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {g.archived && <Tag>{t('groups.archived')}</Tag>}
                {course.archived && <Tag>{t('groups.courseArchived')}</Tag>}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {t('groups.edit')}
          </Button>
          <Button
            variant="ghost"
            disabled={archiveGroup.isPending}
            onClick={() => archiveGroup.mutate({ id: g.id, archived: !g.archived })}
          >
            {t(g.archived ? 'groups.fromArchive' : 'groups.toArchive')}
          </Button>
        </div>
      </PastelCard>

      {archiveGroup.isError && (
        <div role="alert" className="mb-4 text-[13px] font-semibold text-danger">
          {errorText(archiveGroup.error)}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        <KpiTile
          color="lavender"
          label={t('groups.kpiTeacher')}
          value={<span className="text-[22px]">{g.teacher.displayName}</span>}
        />
        <KpiTile
          color={course.color}
          label={t('groups.kpiSeats')}
          value={`${g.enrolledCount} / ${g.capacity}`}
          hint={t('groups.kpiSeatsHint', { n: g.freeSeats })}
        />
        <KpiTile
          color="mint"
          label={t('groups.kpiFormat')}
          value={<span className="text-[22px]">{t(FORMAT_LABEL[course.format])}</span>}
          hint={t(KIND_LABEL[course.kind])}
        />
      </div>

      {(g.meetingUrl || period.length > 0) && (
        <div className="mb-6 flex flex-col gap-3">
          {g.meetingUrl && <MeetingLink url={g.meetingUrl} />}
          {period.length > 0 && (
            <div className="text-sm text-ink-2">
              <span className="font-semibold">{t('groups.period')}:</span> {period.join(' ')}
            </div>
          )}
        </div>
      )}

      <Segmented
        className="mb-4 max-w-sm"
        label={t('groups.tabStudents')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'students', label: t('groups.tabStudents') },
          { value: 'schedule', label: t('groups.tabSchedule') },
        ]}
      />
      {tab === 'students' ? (
        // TODO(T-18): the group's students and "Add student".
        <EmptyState title={t('groups.studentsEmpty')} text={t('groups.studentsEmptyText')} />
      ) : (
        // TODO(T-16): schedule rules and upcoming lessons of the group.
        <EmptyState title={t('groups.scheduleEmpty')} text={t('groups.scheduleEmptyText')} />
      )}

      {editing && <GroupDialog course={course} group={g} onClose={() => setEditing(false)} />}
    </>
  );
}
