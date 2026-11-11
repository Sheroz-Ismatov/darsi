import {
  COURSE_COLORS,
  COURSE_ICONS,
  createCourseRequestSchema,
  type CourseColor,
  type CourseDto,
  type CourseFormat,
  type CourseIcon as CourseIconKey,
  type CourseKind,
} from '@darsi/shared';
import {
  Button,
  cn,
  Dialog,
  Field,
  Input,
  PASTEL_BG,
  Segmented,
  Switch,
  Tag,
  Textarea,
} from '@darsi/ui';
import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { COURSE_ICON } from '../../features/courses/CourseIcon';
import { COLOR_LABEL, KIND_LABEL } from '../../features/courses/course-labels';
import {
  useArchiveCourse,
  useCreateCourse,
  useUpdateCourse,
} from '../../features/courses/courses-api';
import { errorText } from '../../lib/error-text';

const FORM_ID = 'course-form';

/** '' is "no age"; anything else must parse as an integer, or the schema rejects it. */
const parseAge = (value: string): number | null => (value.trim() === '' ? null : Number(value));
const ageInput = (value: number | null): string => (value === null ? '' : String(value));

interface CourseDialogProps {
  /** Absent for a new course. */
  course?: CourseDto;
  onClose: () => void;
  onDelete?: (course: CourseDto) => void;
}

/** W-4 course form (TZ FR-11); editing also archives or deletes the course. */
export function CourseDialog({ course, onClose, onDelete }: CourseDialogProps) {
  const { t } = useTranslation();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const archiveCourse = useArchiveCourse();
  const save = course ? updateCourse : createCourse;

  const [name, setName] = useState(course?.name ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [format, setFormat] = useState<CourseFormat>(course?.format ?? 'offline');
  const [kind, setKind] = useState<CourseKind>(course?.kind ?? 'group');
  const [ageFrom, setAgeFrom] = useState(ageInput(course?.ageFrom ?? null));
  const [ageTo, setAgeTo] = useState(ageInput(course?.ageTo ?? null));
  const [color, setColor] = useState<CourseColor>(course?.color ?? 'lime');
  const [icon, setIcon] = useState<CourseIconKey>(course?.icon ?? 'book-open');
  const [showInCatalog, setShowInCatalog] = useState(course?.showInCatalog ?? true);
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());

  // Group capacities follow the kind, so the server refuses to change it once groups exist.
  const kindLocked = (course?.groups.length ?? 0) > 0;
  const busy = save.isPending || archiveCourse.isPending;
  const error = save.error ?? archiveCourse.error;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createCourseRequestSchema.safeParse({
      name,
      description,
      format,
      kind,
      ageFrom: parseAge(ageFrom),
      ageTo: parseAge(ageTo),
      showInCatalog,
      color,
      icon,
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((issue) => String(issue.path[0]))));
      return;
    }
    setInvalid(new Set());
    archiveCourse.reset();
    if (course) {
      const { kind: newKind, ...rest } = parsed.data;
      updateCourse.mutate(
        { id: course.id, ...rest, ...(!kindLocked && { kind: newKind }) },
        { onSuccess: onClose },
      );
    } else {
      createCourse.mutate(parsed.data, { onSuccess: onClose });
    }
  };

  const toggleArchive = () => {
    if (!course) return;
    save.reset();
    archiveCourse.mutate({ id: course.id, archived: !course.archived }, { onSuccess: onClose });
  };

  const ageInvalid = invalid.has('ageFrom') || invalid.has('ageTo');

  return (
    <Dialog
      open
      onClose={onClose}
      title={course ? t('courses.editTitle', { name: course.name }) : t('courses.createTitle')}
      closeLabel={t('courses.close')}
      footer={
        <>
          {course && (
            <div className="mr-auto flex flex-wrap gap-3">
              <Button variant="ghost" disabled={busy} onClick={toggleArchive}>
                {t(course.archived ? 'courses.fromArchive' : 'courses.toArchive')}
              </Button>
              {onDelete && (
                <Button variant="ghost" disabled={busy} onClick={() => onDelete(course)}>
                  {t('courses.delete')}
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>
            {t(course ? 'courses.save' : 'courses.create')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate>
        <Field
          label={t('courses.fieldName')}
          htmlFor="course-name"
          error={invalid.has('name') ? t('courses.errorName') : null}
        >
          <Input
            id="course-name"
            value={name}
            maxLength={120}
            aria-invalid={invalid.has('name')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label={t('courses.fieldDescription')}
          htmlFor="course-description"
          hint={t('courses.descriptionHint')}
          error={invalid.has('description') ? t('courses.errorDescription') : null}
        >
          <Textarea
            id="course-description"
            rows={3}
            value={description}
            maxLength={2000}
            aria-invalid={invalid.has('description')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="mb-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">{t('courses.fieldFormat')}</span>
            <Segmented
              label={t('courses.fieldFormat')}
              value={format}
              onChange={setFormat}
              options={[
                { value: 'offline', label: t('courses.formatOffline') },
                { value: 'online', label: t('courses.formatOnline') },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">{t('courses.fieldKind')}</span>
            {kindLocked ? (
              <>
                <Tag className="self-start px-4 py-2.5 text-[13px]">{t(KIND_LABEL[kind])}</Tag>
                <span className="text-xs text-muted">{t('courses.kindLocked')}</span>
              </>
            ) : (
              <>
                <Segmented
                  label={t('courses.fieldKind')}
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: 'group', label: t('courses.kindGroup') },
                    { value: 'individual', label: t('courses.kindIndividual') },
                  ]}
                />
                <span className="text-xs text-muted">{t('courses.kindHint')}</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('courses.fieldAgeFrom')} htmlFor="course-age-from" className="mb-2">
            <Input
              id="course-age-from"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={ageFrom}
              aria-invalid={ageInvalid}
              onChange={(event) => setAgeFrom(event.target.value)}
            />
          </Field>
          <Field label={t('courses.fieldAgeTo')} htmlFor="course-age-to" className="mb-2">
            <Input
              id="course-age-to"
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={ageTo}
              aria-invalid={ageInvalid}
              onChange={(event) => setAgeTo(event.target.value)}
            />
          </Field>
        </div>
        {ageInvalid ? (
          <div role="alert" className="mb-4 text-xs font-semibold text-danger">
            {t('courses.errorAge')}
          </div>
        ) : (
          <div className="mb-4 text-xs text-muted">{t('courses.ageHint')}</div>
        )}

        <div className="mb-4 flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">{t('courses.fieldColor')}</span>
          <div role="radiogroup" aria-label={t('courses.fieldColor')} className="flex gap-2.5">
            {COURSE_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={t(COLOR_LABEL[value])}
                title={t(COLOR_LABEL[value])}
                onClick={() => setColor(value)}
                className={cn(
                  'grid size-9 cursor-pointer place-items-center rounded-pill border-2 transition',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                  PASTEL_BG[value],
                  color === value ? 'border-ink' : 'border-transparent hover:border-hairline',
                )}
              >
                {color === value && <Check size={16} strokeWidth={2.2} aria-hidden />}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">{t('courses.fieldIcon')}</span>
          <div
            role="radiogroup"
            aria-label={t('courses.fieldIcon')}
            className="grid grid-cols-6 gap-2 max-[560px]:grid-cols-4"
          >
            {COURSE_ICONS.map((value) => {
              const Icon = COURSE_ICON[value];
              const selected = icon === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(`courses.icons.${value}`)}
                  title={t(`courses.icons.${value}`)}
                  onClick={() => setIcon(value)}
                  className={cn(
                    'grid h-12 cursor-pointer place-items-center rounded-sm border transition',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus',
                    selected
                      ? cn('border-ink', PASTEL_BG[color])
                      : 'border-hairline bg-surface hover:border-ink',
                  )}
                >
                  <Icon size={20} strokeWidth={1.8} aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="course-catalog" className="text-sm font-semibold">
              {t('courses.showInCatalog')}
            </label>
            <div className="mt-0.5 text-xs text-muted">{t('courses.showInCatalogHint')}</div>
          </div>
          <Switch id="course-catalog" checked={showInCatalog} onChange={setShowInCatalog} />
        </div>

        {error && (
          <div role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {errorText(error)}
          </div>
        )}
      </form>
    </Dialog>
  );
}
