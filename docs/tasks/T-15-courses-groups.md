# T-15. Курсы и группы

**Цель.** Админ ведёт каталог школы: курсы и группы с преподавателем и вместимостью. Это основа расписания (T-16)
и зачислений (T-18).

**Требования:** FR-11, FR-12; экраны W-4, W-5.

## Прочитать перед началом

- TZ.md: FR-11, FR-12, сущности Course и Group в §7.1, матрица §7.3.
- DESIGN_SYSTEM.md: §1.2 (пастели курсов), §6 (строка W-4/W-5), §7 (иконки курса).
- Прототип: запусти конфигурацию `design-sample` и открой экраны `TCourses` и `TGroup` — вид страниц берём оттуда.
  Исходник — `design/sample/screens-teacher.jsx`.
- Образцы кода: модули `staff` (T-14) и `platform`.

## Решения (уже приняты)

1. **Удаление и архив.** `DELETE /courses/:id` работает, только если у курса нет ни одной группы (даже архивной);
   иначе 409 `COURSE_HAS_GROUPS`. Курс с группами убирают архивом. У групп удаления нет, только архив.
2. **Архив курса не трогает его группы**: они остаются как есть, но в архивный курс нельзя добавить новую группу.
3. **Индивидуальный курс:** вместимость группы всегда 1 — сервер ставит её сам, что бы ни пришло.
   Тип курса (`kind`) нельзя менять, пока у курса есть группы: 409 `COURSE_KIND_LOCKED`.
4. **Занято мест.** Зачислений ещё нет: метод `countEnrolled(groupIds)` в сервисе групп возвращает нули с пометкой
   `TODO(T-18)`. В ответах уже есть `enrolledCount` и `freeSeats`.
5. **Филиал** — единственный филиал школы, сервер подставляет сам; в интерфейсе его нет.
6. **Преподавателем группы** может быть членство с ролью `teacher` и статусом `active` или `invited` — школа настраивает
   расписание до того, как преподаватель вошёл.
7. **Доступ:** владелец и админ — всё. Чтение для преподавателя и родителя — в задачах Mini App (T-23, T-33).

## Данные

`schema.prisma` (+ миграция по CLAUDE.md):

```
enum CourseFormat { offline online }
enum CourseKind   { group individual }
enum CourseColor  { lime peach coral lavender mint butter }

Course: id, schoolId, name, description?, format, kind, ageFrom?, ageTo?, showInCatalog (default true),
        color, icon (string), archivedAt?, createdAt, updatedAt            @@index([schoolId])
Group:  id, schoolId, branchId, courseId, name, teacherMembershipId, capacity, meetingUrl?,
        startsOn? (date), endsOn? (date), archivedAt?, createdAt, updatedAt
        @@index([schoolId]) @@index([courseId]) @@index([teacherMembershipId])
```

Таблицы `courses`, `groups`; связи с `School` (Cascade), `Course` (Restrict), `Membership`, `Branch` (Restrict).
В `packages/shared/src/constants.ts` добавь `COURSE_FORMATS`, `COURSE_KINDS` и `COURSE_ICONS` — 12 ключей из
DESIGN_SYSTEM.md §7 в kebab-case (`book-open`, `palette`, …). `COURSE_COLORS` уже есть.

## API

Модуль `apps/api/src/modules/courses` (курсы и группы вместе). Контракты — `contracts/courses.ts`.
Все эндпоинты — `@SchoolRoles('owner', 'admin')`.

| Эндпоинт | Поведение |
|---|---|
| `GET /courses?archived=false` | Курсы с их группами: у группы `id, name, teacherName, capacity, enrolledCount, freeSeats, archived` |
| `POST /courses` · `PATCH /courses/:id` | Поля ниже |
| `POST /courses/:id/archive` · `/unarchive` | |
| `DELETE /courses/:id` | 204 или 409 `COURSE_HAS_GROUPS` |
| `GET /groups?courseId=` · `GET /groups/:id` | `GroupDto`: поля группы + `course { id, name, color, icon, kind, format }`, `teacher { id, displayName }`, `enrolledCount`, `freeSeats` |
| `POST /groups` · `PATCH /groups/:id` | |
| `POST /groups/:id/archive` · `/unarchive` | |

Правила полей:

- Курс: `name` 2–120; `description` до 2000; `ageFrom`/`ageTo` целые 0–99, `ageFrom ≤ ageTo`; `color` и `icon` — из списков.
- Группа: `name` 1–120; `capacity` 1–500; `meetingUrl` — `https://`, до 500; `endsOn ≥ startsOn`;
  `courseId` — курс этой школы и не в архиве (иначе 404 `COURSE_NOT_FOUND` / 409 `COURSE_ARCHIVED`);
  `teacherMembershipId` — по решению 6, иначе 422 `TEACHER_NOT_FOUND`.
- Перенос группы в другой курс не поддерживается: `courseId` в `PATCH` нет.
- Создание, изменение, архив и удаление — в `AuditLog`.

## Веб

Папка `apps/web/src/pages/courses`, общие части — `apps/web/src/features/courses`.

- **`CourseIcon`** — компонент «ключ → иконка lucide» и фон-пастель курса (`PASTEL_BG` из `@darsi/ui`).
- **W-4 «Курсы»** (`/courses`) по образцу `TCourses`: каждый курс — блок с пастельной шапкой (иконка, название, формат,
  возраст, метка «Не в каталоге», если скрыт), под ней сетка карточек групп: название, преподаватель,
  `ProgressBar` и «занято/мест», клик ведёт в группу. Последняя карточка — пунктирная «+ Добавить группу».
  Сверху — «Новый курс» и чип «Архив». Пустое состояние с призывом создать первый курс.
- **Диалог курса:** название, описание, формат и тип (`Segmented`), возраст от/до, цвет (6 кружков-пастелей),
  иконка (сетка из 12), «Показывать в каталоге» (`Switch` из T-13). В редактировании — «В архив» и «Удалить»
  (удаление с подтверждением; при `COURSE_HAS_GROUPS` — понятный текст).
- **Диалог группы:** название, преподаватель (список из `GET /staff?role=teacher`, отключённые не показываются;
  если преподавателей нет — подсказка со ссылкой на «Сотрудники» для владельца), вместимость (скрыта и равна 1 для
  индивидуального курса), ссылка на видеозвонок (только для онлайн-курса), даты начала и окончания.
- **W-5 «Группа»** (`/groups/:id`, раздел меню «Курсы» остаётся активным) по образцу `TGroup`: пастельная шапка
  с курсом и названием, три плитки `KpiTile` (преподаватель, занято мест, формат), кнопки «Изменить» и «В архив»,
  ссылка на звонок с «Скопировать». Вкладки (`Segmented`): «Ученики» и «Расписание» — пока `EmptyState` с пометками
  `TODO(T-18)` и `TODO(T-16)`.

## Тесты

`apps/api/test/courses.e2e-spec.ts`:

- `describeSchoolIsolation` для всех эндпоинтов; пути с `:id` — с записью школы A;
- права: владелец и админ — всё; преподаватель и родитель — 403;
- курс: создание, изменение, архив и возврат; фильтр `archived`; валидация возраста, цвета, иконки;
- удаление пустого курса — 204; с группой (в том числе архивной) — 409;
- группа: преподаватель из другой школы, родитель, отключённый — 422; приглашённый преподаватель — можно;
- группа в чужой курс (курс школы B) — 404; в архивный — 409;
- индивидуальный курс: вместимость 5 в запросе → 1 в ответе; смена типа при наличии групп — 409;
- `freeSeats = capacity − enrolledCount`.

## Готово, когда

- [ ] В браузере: создан курс с цветом и иконкой, две группы, одна отправлена в архив; страницы сверены с
      `TCourses` и `TGroup` (скриншоты в отчёте не нужны, достаточно перечислить расхождения, если они есть).
- [ ] Курс с выключенным «Показывать в каталоге» помечен в списке.
- [ ] Курс с группами не удаляется, пустой — удаляется.
- [ ] Общий список из `docs/tasks/README.md`.

## Не входит

Правила расписания и занятия (T-16); ученики группы и реальная занятость (T-18); каталог для родителей (T-33);
цены и абонементы (T-20).
