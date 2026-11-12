# Архитектура «Дарси́» (MVP)

Основание: [TZ.md](TZ.md) v1.0, визуальный язык — [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 1. Контекст

- **Тип продукта:** мультиарендный SaaS. Три клиента — веб-панель (React SPA), Telegram Mini App (React SPA внутри Telegram), Telegram-бот — и одно REST API.
- **Пользователи:** суперадмин, владелец и админ школы (веб), преподаватель и родитель (TMA).
- **Ключевые сценарии:** UC-1…UC-12 из ТЗ. Самые нагруженные по логике: отметка посещения со списанием абонемента (UC-6), заявка → зачисление (UC-5), баланс и оплаты (UC-7/8).
- **Границы MVP:** раздел 6 ТЗ. Платёжных шлюзов, биллинга, сдачи ДЗ, филиалов в UI нет.

## 2. Стек

### 2.1. Рассмотренные варианты

| Вариант | Плюсы | Минусы |
|---|---|---|
| **A. Самый быстрый:** Supabase (Postgres + Auth + Storage) + React | Мало бэкенда, бесплатный тариф | Бизнес-логика списаний в SQL/RLS или edge-функциях, слабый контроль; vendor lock-in мешает переезду в РФ |
| **B. Масштабируемый:** NestJS + PostgreSQL + Redis/BullMQ + React, Docker | Явные модули, DI, очереди, переносимость, один язык | Больше кода на старте |
| **C. Самый простой в поддержке:** Fastify + Drizzle, без очередей (cron в процессе) | Минимум абстракций | Самописная структура модулей, отложенные уведомления без надёжной очереди |

**Решение — вариант B** (совпадает с выбором в ТЗ). Компромисс: ~1 неделя на каркас окупается предсказуемой структурой для одного разработчика с Claude Code,
надёжными отложенными уведомлениями и беспроблемным переездом в облако РФ.

### 2.2. Итоговый стек

| Слой | Выбор | Почему |
|---|---|---|
| Монорепо | pnpm workspaces | Общие типы и схемы между API и двумя фронтами |
| Backend | NestJS 11 (Express), TypeScript strict | Модули + DI + guards под RBAC и мультиарендность |
| Валидация и контракты | **zod** в `packages/shared` + `nestjs-zod` | Одна схема на сервере и клиенте, типы выводятся автоматически |
| БД | PostgreSQL 16 | Транзакции для денег, jsonb для аудита |
| ORM | Prisma 6 + Prisma Migrate | Типобезопасные запросы, миграции |
| Очереди и планировщик | Redis 7 + BullMQ (repeatable jobs) | Напоминания, генерация занятий, истечение абонементов; дедупликация и повторы |
| Бот | grammY: long-polling в dev, webhook в prod | Простой, типизированный, хорошо работает с Mini Apps |
| Авторизация | Telegram `initData` (TMA), Telegram Login Widget (веб) → свои JWT | Без паролей, как в ТЗ |
| Веб и TMA | React 19 + Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, `lucide-react` | Быстрая сборка, кэш запросов, токены дизайн-системы |
| TMA SDK | Официальный `telegram-web-app.js` + `@types/telegram-web-app` | `initData`, BackButton, MainButton, тема, safe-area; стабильный API без промежуточных обёрток |
| i18n | i18next + react-i18next; словари `ru`, `tg` в `packages/shared` | Общие тексты для TMA и бота |
| Даты и часовые пояса | `date-fns` + `date-fns-tz` | Время школы ↔ UTC |
| Файлы | S3-совместимое хранилище: MinIO (dev) / Cloudflare R2 (пилот) через `@aws-sdk/client-s3`, presigned URL | Переносимо в Yandex Object Storage |
| Логи | `nestjs-pino` (JSON) | Структурированные логи с `request_id`, без ПДн |
| Ошибки | Sentry (бесплатный тариф) | Бэк, веб, TMA |
| Тесты | Vitest везде (API — через `unplugin-swc`, пул `threads`), Supertest, Playwright (веб) | Один раннер на весь монорепозиторий |
| Версии | Node 24, TypeScript 5.9 (TS 7 пока не поддерживают typescript-eslint, tsup и Nest), NestJS 11, Prisma 6, zod 4, Vitest 5 | Проверенные мажорные версии; переход на Nest 12 / Prisma 7 — после MVP |
| CI | GitHub Actions: lint → typecheck → test (Postgres + Redis services) → build | Бесплатно для приватного репо в пределах лимитов |
| Развёртывание | Docker Compose + Caddy (авто-HTTPS) на Oracle Cloud Always Free VM | Бесплатно, переносимо |

## 3. Архитектура

### 3.1. Компоненты и поток данных

```
 Telegram-клиент                         Браузер (админ)
 ┌──────────────┐                       ┌──────────────┐
 │  TMA (React) │                       │ Web (React)  │
 └──────┬───────┘                       └──────┬───────┘
        │ HTTPS /api/v1  (Bearer JWT, X-School-Id)
        ▼                                      ▼
 ┌─────────────────────────── Caddy (TLS, статика web/tma) ─────────────────────────┐
 └───────────────┬───────────────────────────────────────────────┬──────────────────┘
                 ▼                                               ▼ /bot/webhook
        ┌─────────────────┐   enqueue   ┌───────────┐     ┌────────────────┐
        │ api (NestJS)    │────────────▶│  Redis    │◀────│ worker (NestJS)│── Bot API ──▶ Telegram
        │ REST + bot hook │             │  BullMQ   │     │ jobs + sender  │
        └───────┬─────────┘             └───────────┘     └───────┬────────┘
                └──────────────┬──────────────────────────────────┘
                               ▼
                 ┌──────────────────────────┐      ┌────────────────────┐
                 │ PostgreSQL 16            │      │ S3 (R2 / MinIO)    │
                 └──────────────────────────┘      └────────────────────┘
```

Один Docker-образ `api` запускается в двух ролях: `api` (HTTP + webhook бота) и `worker` (процессоры очередей и расписание).

### 3.2. Слои внутри API

```
controller  — HTTP, валидация zod-DTO, извлечение контекста (user, school, role)
service     — бизнес-сценарии, транзакции, права «на объект»
domain      — чистые функции без IO из packages/shared/domain (правила списания, баланс, зарплата, генерация занятий)
repository  — Prisma; каждый метод принимает schoolId (кроме суперадмина)
```

Clean Architecture применяем точечно: **доменные правила, где ошибка стоит денег** (списание, баланс, зарплата, генерация расписания), вынесены
в чистые функции с 100%-м покрытием тестами. Остальное — классический CRUD Nest «контроллер → сервис → Prisma» без лишних абстракций.

### 3.3. Модули API

| Модуль | Ответственность | FR |
|---|---|---|
| `auth` | Обмен `initData` и Login Widget на JWT, refresh, приглашения (accept) | FR-1…3, FR-9, FR-17 |
| `tenancy` | Guard текущей школы и роли, декораторы `@Roles()`, `@CurrentSchool()` | FR-4, FR-5 |
| `platform` | Суперадмин: школы, тарифы, лимиты | FR-1, FR-6 |
| `schools` | Профиль и настройки школы, ссылка/QR | FR-7…9 |
| `staff` | Сотрудники, приглашения, ставки зарплаты | FR-10, FR-51 |
| `courses` | Курсы, группы, правила расписания | FR-11…14 |
| `lessons` | Генерация, отмена, перенос, разовые занятия, календарь | FR-13, FR-15, FR-16 |
| `students` | Ученики, родители (guardians), зачисления, архив | FR-17…21 |
| `requests` | Заявки на запись и их обработка | FR-22…24 |
| `subscriptions` | Шаблоны, назначение, заморозка, истечение, корректировки | FR-25…30 |
| `attendance` | Отметки, окно редактирования, списание | FR-26, FR-31…33 |
| `billing` | Ledger, оплаты, сторно, баланс | FR-34…37 |
| `homework` | ДЗ и файлы | FR-38, FR-39 |
| `files` | Presigned upload/download, проверка MIME и размера | FR-38 |
| `notifications` | Шаблоны (i18n), постановка в очередь, лог, учёт блокировки бота | FR-41…47 |
| `reports` | Выручка, должники, посещаемость, зарплата, дашборд, XLSX-экспорт | FR-48…53 |
| `parent` | Агрегирующие эндпоинты для TMA родителя (главная, карточка ребёнка, каталог) | FR-54…57 |
| `teacher` | Агрегирующие эндпоинты для TMA преподавателя | FR-58, FR-59 |
| `audit` | Запись и чтение журнала | FR-60 |
| `privacy` | Согласия, анонимизация | FR-62, FR-63 |
| `bot` | grammY: `/start` с payload, кнопка меню, webhook | — |
| `health` | `/health` (БД, Redis) | 10.5 |

### 3.4. Основные эндпоинты (`/api/v1`)

| Группа | Эндпоинты |
|---|---|
| Auth | `POST /auth/tma` · `POST /auth/telegram-login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /me` (профиль + членства) · `POST /invites/:token/accept` · `POST /schools/by-code/:code/join` |
| Суперадмин | `GET/POST /platform/schools` · `PATCH /platform/schools/:id` · `POST /platform/schools/:id/owner-invite` · `GET/POST/PATCH /platform/plans` |
| Школа | `GET/PATCH /school` · `GET /school/join-link` (ссылка + QR PNG) |
| Сотрудники | `GET/POST /staff` · `PATCH /staff/:id` · `POST /staff/:id/invite` · `GET/POST /staff/:id/salary-rates` |
| Курсы | `GET/POST /courses` · `PATCH /courses/:id` · `POST /courses/:id/archive` |
| Группы | `GET/POST /groups` · `GET/PATCH /groups/:id` · `GET/PUT /groups/:id/schedule-rules` · `GET /groups/:id/conflicts` |
| Занятия | `GET /lessons?from&to&teacherId&groupId` · `POST /lessons` (разовое) · `GET /lessons/:id` · `POST /lessons/:id/cancel` · `POST /lessons/:id/reschedule` · `PUT /lessons/:id/attendance` · `PUT /lessons/:id/homework` |
| Ученики | `GET/POST /students` · `GET/PATCH /students/:id` · `POST /students/:id/archive` · `POST /students/:id/invite` · `POST /students/:id/enrollments` · `POST /enrollments/:id/leave` · `POST /enrollments/:id/transfer` |
| Заявки | `GET /requests?status` · `POST /requests/:id/approve` · `POST /requests/:id/reject` |
| Абонементы | `GET/POST /subscription-templates` · `PATCH /subscription-templates/:id` · `POST /students/:id/subscriptions` · `POST /subscriptions/:id/freeze` · `POST /subscriptions/:id/unfreeze` · `POST /subscriptions/:id/adjust` |
| Деньги | `GET /payments` · `POST /payments` · `POST /payments/:id/reverse` · `GET /students/:id/ledger` |
| Отчёты | `GET /reports/dashboard` · `/reports/revenue` · `/reports/debtors` · `/reports/attendance` · `/reports/salary` · `GET /reports/:kind/export.xlsx` |
| Файлы | `POST /files/upload-url` · `GET /files/:id/download-url` |
| Аудит | `GET /audit?entity&entityId` |
| TMA родителя | `GET /parent/home` · `GET/POST /parent/children` · `GET /parent/children/:id` · `GET /parent/catalog` · `GET/POST /parent/requests` · `GET /parent/homework` · `PATCH /parent/settings` |
| TMA преподавателя | `GET /teacher/lessons?date` · `GET /teacher/groups` · `GET /teacher/groups/:id` |
| Сервис | `GET /health` · `POST /bot/webhook/:secret` |

Контекст школы передаётся заголовком `X-School-Id` (кроме `/me`, `/auth/*`, `/platform/*`). Контракты (zod-схемы запросов и ответов) лежат в `packages/shared/src/contracts`.

### 3.5. Модель данных

Сущности, поля и матрица прав — раздел 7 ТЗ. Дополнения уровня реализации:
- `Course.color` (enum из 6 пастелей) и `Course.icon` (ключ иконки) — из дизайн-системы.
- `RefreshToken` (id, user_id, hash, expires_at, revoked_at, user_agent) — ротация refresh-токенов.
- `InviteToken` хранится как SHA-256 хэш, исходный токен показывается один раз.
- Индексы: `(school_id, starts_at)` у Lesson; `(lesson_id, student_id)` уникальный у Attendance; `(school_id, student_id, created_at)` у LedgerEntry;
  частичный уникальный `(student_id, group_id) WHERE status='new'` у EnrollmentRequest; `dedup_key` уникальный у NotificationLog.
- Баланс — представление `student_balance` (сумма `LedgerEntry.amount` по ученику), без денормализации в MVP.

### 3.6. Ключевые алгоритмы (`packages/shared/src/domain`)

- **`shouldCharge(status, policy)`** → bool: present → true; absent → `policy.chargeAbsent`; excused → `policy.chargeExcused`.
- **`pickSubscription(subs, courseId, lessonDate)`** → активная (не заморожена на дату, `starts_on ≤ дата ≤ ends_on`, остаток > 0 или monthly) с ближайшим `ends_on`; иначе `null` → неоплаченное посещение.
- **`applyAttendanceChange(prev, next)`** → список операций: вернуть занятие в старый абонемент, списать из нового — в одной транзакции с `SELECT … FOR UPDATE` на абонементы ученика.
- **`generateLessons(rules, from, to, tz, existing)`** → создание недостающих занятий, удаление и пересоздание будущих `planned` без отметок; переход на летнее время не важен (`Asia/Dushanbe` без DST), но учитывается для РФ.
- **`freezeShift(sub, from, to)`** → новый `ends_on`.
- **`calcSalary(rates, lessons, attendance, period)`** → построчный расчёт; ставка выбирается по `valid_from` на дату занятия, оклад — пропорционально дням периода.
- **Деньги** — `bigint` в минимальных единицах; в JSON отдаются строкой; форматирование только на клиенте.

### 3.7. Обработка ошибок

- Единый формат: `{ "error": { "code": "SUBSCRIPTION_FROZEN", "message": "...", "details": {...} } }`. `code` — стабильный ключ, клиент показывает перевод из i18n.
- Глобальный exception filter: ошибки zod → 400 `VALIDATION_ERROR` с полями; доменные → 409/422 со своими кодами; доступ → 403; чужая школа → 404 (не раскрываем существование).
- Неожиданные → 500 с `request_id`, в Sentry, без стека клиенту.
- Клиенты: TanStack Query с повтором только для сетевых ошибок и 5xx; TMA хранит отметку посещения в очереди `localStorage` при отсутствии сети (UC-6).

### 3.8. Безопасность

- **Аутентификация.** `initData` проверяется по HMAC-SHA256 (ключ — HMAC("WebAppData", bot_token)), `auth_date` ≤ 24 ч. Login Widget — SHA-256(bot_token) как ключ.
  Access JWT (HS256, 1 ч) в памяти клиента; refresh (30 дней) — httpOnly Secure SameSite=Strict cookie для веба. TMA при старте всегда заново обменивает `initData`.
- **Авторизация.** Guard: `user` → membership в `X-School-Id` → роль из `@Roles()`. Права «на объект» (преподаватель — только свои группы, родитель — только свои дети) проверяются в сервисах. Отдельный e2e-набор «чужая школа / чужой ребёнок» на каждый эндпоинт.
- **Валидация.** zod на входе каждого эндпоинта; лимиты длины строк; файлы — allowlist MIME и 10 МБ, проверка «магических байтов».
- **Секреты.** Только `.env` (в git — `.env.example`); `BOT_TOKEN`, `JWT_SECRET`, `WEBHOOK_SECRET`, `S3_*`, `DATABASE_URL`.
- **Прочее.** Helmet, CORS allowlist (домены web и tma), rate-limit через `@nestjs/throttler` с хранилищем в Redis (60/мин на пользователя, 10/мин на `/auth/*`), webhook бота с секретом в пути и заголовке `X-Telegram-Bot-Api-Secret-Token`.

### 3.9. Фоновые задачи (worker)

| Очередь / job | Расписание | Что делает |
|---|---|---|
| `lessons.extend-horizon` | ежедневно 02:00 UTC | Догенерирует занятия до горизонта 8 недель |
| `subscriptions.expire` | каждый час | Переводит истёкшие в `expired`, считает сгоревшие, ставит уведомление |
| `notify.lesson-reminders` | каждые 5 мин | Ищет занятия, начинающиеся через N ч ± 5 мин, ставит напоминания (dedup `reminder:{lesson}:{student}`) |
| `notify.debt` | каждый час | Для школ, где сейчас 10:00 местного, — должникам раз в 7 дней |
| `notify.send` | по событию | Отправка в Telegram с лимитом 25/с, 3 повтора, 403 → `bot_blocked` |

До появления очередей (T-38) `lessons.extend-horizon` временно запускается внутри процесса API через `@nestjs/schedule` (включается переменной `JOBS_ENABLED`).

### 3.10. Логирование и мониторинг

pino JSON-логи с `request_id`, `user_id`, `school_id` (без ФИО и телефонов); `/health`; Sentry; UptimeRobot на `/health` и TMA; Docker log rotation; ежедневный `pg_dump` в R2 с хранением 14 дней.

### 3.11. Структура репозитория

```
darsi/
  apps/
    api/        NestJS: src/modules/*, src/common/*, prisma/, test/
    web/        React: src/pages/*, src/features/*, src/app/*
    tma/        React: src/pages/{parent,teacher,onboarding}/*, src/app/*
  packages/
    shared/     contracts (zod), domain (чистые функции), i18n (ru, tg), constants
    ui/         tokens.css, шрифты, компоненты дизайн-системы, tailwind preset
  infra/        docker-compose.yml (dev), docker-compose.prod.yml, Caddyfile, backup.sh
  design/       прототип (эталон стиля)
  .github/workflows/ci.yml
  TZ.md  ARCHITECTURE.md  IMPLEMENTATION_PLAN.md  DESIGN_SYSTEM.md  README.md
```

### 3.12. Локальная разработка Telegram

TMA требует HTTPS-URL. В dev: Vite на `localhost`, публичный HTTPS через `cloudflared tunnel` (бесплатно, без аккаунта для quick tunnel); тестовый бот у разработчика.
Для работы без Telegram — dev-режим `VITE_DEV_MOCK_INIT_DATA` + серверный флаг `AUTH_DEV_BYPASS=true` (только `NODE_ENV=development`, отклоняется в production при старте).

## 4. Технические риски

| Риск | Снижение |
|---|---|
| Гонки при одновременной отметке и назначении абонемента → двойное списание | Транзакция + `SELECT … FOR UPDATE` на абонементы ученика; уникальность `(lesson, student)`; тесты конкурентности |
| Ошибки часовых поясов в расписании и напоминаниях | Всё в UTC, локальное время только в `ScheduleRule.start_time` + `School.timezone`; тесты для `Asia/Dushanbe` и `Europe/Moscow` |
| Утечка данных между школами | Обязательный `schoolId` в репозиториях, guard, e2e-набор изоляции в CI |
| Лимиты Telegram при рассылках | Очередь с ограничением 25/с, дедупликация |
| Нестабильность бесплатной VM | Бэкапы вне VM, IaC-скрипт развёртывания за 1 час, мониторинг |
| Отсутствие таджикских глифов в шрифтах | Проверка на T-04; fallback |
| Лимиты бесплатного Upstash (команды в месяц) при постоянно запущенном BullMQ-воркере в разработке | Воркер в dev запускать только при работе над фоновыми задачами; в продакшне Redis — на своей VM |
| Neon засыпает после простоя (холодный старт ~1 с) | Таймаут health-проверки 3 с; в продакшне PostgreSQL — на своей VM |
| Регрессии в денежной логике при развитии | Доменные функции с полным покрытием, снапшот-тесты отчётов |
