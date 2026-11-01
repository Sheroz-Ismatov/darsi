# Дарси-онлайн — общая структура проекта

> Главный документ. Содержит полную картину продукта со всеми уточнениями, согласованными с заказчиком.
> Любые изменения в видении продукта вносить **сюда** в первую очередь.

**Источник истины:** `Дарси́-онлайн.pdf` (видение от заказчика) + ответы на уточняющие вопросы во время планирования.
**Дата фиксации структуры:** 2026-05-08.

---

## 1. Контекст и цель

SaaS для автоматизации работы образовательных центров (кружков, школ дополнительного образования).
**Пилотный клиент:** Робоцентр — небольшой центр робототехники, один преподаватель самостоятельно ведёт несколько курсов.

**Цель MVP (4 недели):** дать преподавателю инструмент управления курсами/группами/посещаемостью/материалами, а родителям — удобный канал записи детей, расписания, уведомлений и оплаты через ЮKassa, с доступом к материалам пропущенных занятий.

**Модель монетизации:**
- Робоцентр получает бесплатную разработку в обмен на пилотное использование.
- После пилота — абонентская плата за использование платформы.
- В перспективе — масштабирование на другие центры (multi-tenant заложено сразу).

---

## 2. Ключевые продуктовые решения (все согласованы)

| Решение | Значение | Обоснование |
|---------|----------|-------------|
| Тип продукта | SaaS для центра (не marketplace) | Соответствует PDF; объявления/рейтинги/публичные чаты не делаем |
| Авторизация | Telegram **или** телефон + SMS-код | Любой способ создаёт единый профиль |
| Веб-клиент | Адаптивный SPA (без PWA в MVP) | Снижение сложности; PWA можно добавить позже |
| Уведомления | Приоритет Telegram, fallback на SMS | Telegram бесплатно; SMS — для тех, кто не привязал бота |
| Multi-tenant | `center_id` во всех сущностях с самого начала | Избежать миграции после пилота |
| Мероприятия | Включены в MVP | Запрос заказчика |
| Оплаты | ЮKassa с самого начала | Получатель — преподаватель (самозанятый), автоматический чек НПД |
| Абонементы | Пропуск **сгорает** | Но: открывается доступ к материалам/видео/ДЗ занятия |
| Чат | Только комментарии родителя к отметке «не придёт» | Полноценный чат — после пилота |
| Хостинг | Yandex Cloud | Соответствие ФЗ-152 |

---

## 3. Роли пользователей

| Роль | Что может |
|------|-----------|
| **Родитель** | Регистрация, добавление детей, запись на курсы, оплата, отметки «придёт/не придёт», просмотр материалов и ДЗ, расписание |
| **Преподаватель** | CRUD курсов и групп, журнал занятий с фактической посещаемостью, публикация материалов и ДЗ, статистика, мероприятия |
| **Администратор** | Управление центром, преподавателями, курсами, отчёты — **после пилота** (заглушка `/admin/*` в MVP) |
| **Ученик** | Отдельная роль — **после пилота** |

---

## 4. Стек

| Слой | Технология | Версия |
|------|------------|--------|
| Backend | Python + FastAPI + SQLAlchemy 2 + Alembic + Pydantic v2 | 3.12 |
| БД | PostgreSQL | 16, Yandex Cloud Managed |
| Кэш / rate-limit | Redis | 7 |
| Очередь задач | Celery + Redis broker | 5.4 |
| Frontend | React + TypeScript + Vite + Tailwind CSS + React Query + React Router | 18 / 5.7 / 6 |
| Telegram-бот | python-telegram-bot (long-polling в dev, webhook в prod) | 21 |
| Платежи | yookassa SDK + чек самозанятому | 3.5 |
| SMS | SMS.ru / SMS Aero | — |
| Файлы (видео/материалы) | Yandex Object Storage (S3-совместимое), pre-signed URL | — |
| Хостинг | Yandex Cloud VM + nginx (TLS, статика, прокси API/WS) | — |
| Мониторинг | Sentry + Prometheus + Grafana | — |
| Контейнеризация | Docker + docker-compose | — |
| CI/CD | GitHub Actions: lint → тесты → docker build → deploy по SSH | — |

---

## 5. Архитектура (высокоуровневая)

```
┌────────────┐      HTTPS       ┌─────────────────┐
│ React SPA  │ ────────────────▶│ nginx (TLS)     │
└────────────┘                   │  /              │── статика SPA
                                 │  /api/v1        │── FastAPI
                                 │  /ws            │── WS (комменты)
                                 └────┬────────────┘
┌─────────────┐    webhook            │
│ Telegram    │ ─────────────────────▶│
└─────────────┘                       │
                                      ▼
                 ┌──────────────┬──────────────┬──────────────┐
                 │ FastAPI      │ Celery worker│ Telegram bot │
                 │ /api/v1      │              │              │
                 └──────┬───────┴──────┬───────┴──────────────┘
                        │              │
                        ▼              ▼
              ┌──────────────────────────────┐
              │ PostgreSQL │ Redis │ S3      │
              └──────────────────────────────┘
                                  │
                                  ▼
                          ЮKassa, SMS API
```

---

## 6. Модель данных (MVP)

| Сущность | Ключевые поля |
|----------|---------------|
| `centers` | id, name, slug, timezone, yookassa_shop_id, yookassa_secret_key |
| `users` | id, **center_id**, role (parent/teacher/admin), phone, telegram_id, full_name, consent_at, created_at, deleted_at |
| `auth_codes` | phone, code_hash (bcrypt), expires_at, attempts |
| `telegram_links` | user_id, telegram_id, deep_link_token, expires_at, linked_at |
| `children` | id, parent_id, full_name, birth_date |
| `courses` | id, **center_id**, teacher_id, title, description, price_per_lesson, subscription_price, subscription_lessons |
| `groups` | id, course_id, weekday, start_time, duration_min, capacity |
| `lessons` | id, group_id, date, status (planned/done/cancelled), topic, materials_published_at |
| `lesson_materials` | id, lesson_id, kind (text/file/video_url), title, body, file_url |
| `homeworks` | id, lesson_id, title, body, due_at |
| `homework_submissions` | id, homework_id, child_id, comment, file_url, submitted_at |
| `enrollments` | id, child_id, group_id, status (active/paused/cancelled), started_at, ended_at |
| `attendances` | id, lesson_id, child_id, planned_status, absence_reason, actual_status, used_subscription_lesson |
| `events` | id, **center_id**, teacher_id, title, description, start_at, capacity, price |
| `event_registrations` | id, event_id, child_id, payment_id, status |
| `subscriptions` | id, child_id, course_id, lessons_total, lessons_used, expires_at, payment_id |
| `payments` | id, parent_id, kind, amount, yookassa_payment_id, yookassa_receipt_id, status, created_at, paid_at |
| `notifications_log` | id, user_id, channel (telegram/sms), template, payload, status, sent_at, error |
| `pii_access_log` | id, user_id, accessed_by, accessed_at, fields |

---

## 7. Карта страниц веб-приложения

### 7.1 Публичные / общие
| # | Маршрут | Назначение |
|---|---------|------------|
| 1 | `/` | Лендинг центра |
| 2 | `/login` | Выбор: Telegram / телефон + SMS |
| 3 | `/login/verify` | Ввод SMS-кода + согласие ФЗ-152 |
| 4 | `/login/telegram-callback` | Обработка возврата с Telegram |
| 5 | `/terms`, `/privacy` | Соглашения |
| 6 | `/404`, `/403` | — |

### 7.2 Кабинет родителя `/parent/*`
| # | Маршрут | Назначение |
|---|---------|------------|
| 7 | `/parent` | Главная: ближайшие занятия, абонементы, задолженности |
| 8 | `/parent/children` | Список детей + добавить/редактировать/удалить |
| 9 | `/parent/courses` | Каталог курсов центра |
| 10 | `/parent/courses/:id` | Описание курса + список групп |
| 11 | `/parent/enroll/:groupId` | Запись: ребёнок → способ оплаты → ЮKassa |
| 12 | `/parent/schedule` | Календарь занятий ребёнка |
| 13 | `/parent/lessons/:id` | Детали занятия, отметка «придёт/не придёт», материалы, ДЗ |
| 14 | `/parent/payments` | История платежей, активные абонементы |
| 15 | `/parent/events` | Мероприятия + запись + оплата |
| 16 | `/parent/notifications` | Журнал уведомлений |
| 17 | `/parent/profile` | Телефон, Telegram, согласие, удаление аккаунта |

### 7.3 Кабинет преподавателя `/teacher/*`
| # | Маршрут | Назначение |
|---|---------|------------|
| 18 | `/teacher` | Сегодняшние занятия + метрики недели |
| 19 | `/teacher/courses` | CRUD курсов |
| 20 | `/teacher/courses/:id` | Редактирование курса + группы |
| 21 | `/teacher/groups/:id` | Состав, расписание, ближайшие занятия |
| 22 | `/teacher/lessons/:id` | Журнал: фактическая посещаемость + публикация темы/материалов/видео/ДЗ |
| 23 | `/teacher/events` | CRUD мероприятий |
| 24 | `/teacher/students` | Все дети + посещаемость + оплаты |
| 25 | `/teacher/stats` | Посещаемость по группам, доход, должники, прогноз загрузки |
| 26 | `/teacher/profile` | Телефон, Telegram, реквизиты ЮKassa, ИНН |

### 7.4 Админ (заглушка)
| # | Маршрут | Назначение |
|---|---------|------------|
| 27 | `/admin/*` | Пользователи, центры, отчёты — **после пилота** |

---

## 8. Telegram-бот: команды и сценарии

### Команды
- `/start <token>` — привязка аккаунта по deep-link с сайта.
- `/start` без токена — приветствие + кнопка «Открыть приложение» (web_app).

### Inline-кнопки (в напоминаниях)
- «Приду» / «Не приду + комментарий»

### Сценарии уведомлений (Celery beat)
| Событие | Когда | Канал |
|---------|-------|-------|
| Подтверждение записи | сразу | Telegram → SMS |
| Напоминание за день | 18:00 MSK накануне | Telegram → SMS |
| Напоминание утром | 08:00 MSK в день занятия | Telegram → SMS |
| Запрос отметки «придёт/не придёт» | за 24 ч | Telegram (inline) |
| Чек об оплате | сразу после webhook ЮKassa | Telegram → SMS |
| Публикация материалов | при публикации преподавателем | Telegram |

---

## 9. Финансовая логика

- **Оплата за занятие** — поштучно через ЮKassa.
- **Абонемент** — N занятий, цена `subscription_price`. При посещении: `lessons_used += 1`.
- **Пропуск занятия:** если ребёнок не пришёл — занятие **сгорает**, но в `/parent/lessons/:id` остаётся доступ к материалам/видео/ДЗ.
- **Получатель оплат** в MVP — преподаватель как самозанятый. ЮKassa формирует чек НПД автоматически.
- **Webhook ЮKassa** обновляет `payments.status` и активирует абонемент / событие / списывает занятие.

---

## 10. Соответствие ФЗ-152

| Требование | Реализация |
|------------|------------|
| Хранение ПД на серверах в РФ | Yandex Cloud (Managed PostgreSQL, VM, Object Storage) |
| Согласие на обработку ПД | Чекбокс на `/login/verify`, поле `users.consent_at` |
| Шифрование «в движении» | HTTPS-only, HSTS |
| Шифрование секретов | bcrypt для `auth_codes.code_hash` |
| Refresh-токен | HttpOnly secure cookie, scope `/api/v1/auth` |
| Rate-limit | Redis: 5 запросов/мин на `/auth/*` |
| CORS | allowlist через ENV |
| Журнал доступа к ПД | `pii_access_log` middleware |
| Право на удаление | Soft-delete (`deleted_at`) → физическое удаление через 30 дней (Celery) |
| Бэкапы | Postgres ежедневно, retention 14 дней |
| Документ «Политика обработки ПД» | Опубликован на `/privacy` |

---

## 11. Структура репозитория

```
darsi/
├── docs/                    Этот документ + отчёты по этапам
├── backend/
│   ├── app/
│   │   ├── api/v1/          FastAPI routers
│   │   ├── core/            config, security, db, redis, deps, logging
│   │   ├── models/          SQLAlchemy
│   │   ├── schemas/         Pydantic
│   │   ├── services/        бизнес-логика
│   │   ├── workers/         Celery tasks
│   │   ├── scripts/         seed, утилиты
│   │   └── main.py
│   ├── alembic/
│   ├── tests/{unit,integration}/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── pages/{auth,parent,teacher}/
│   │   ├── components/{layout,ui}/
│   │   ├── api/             React Query hooks
│   │   ├── lib/             axios, утилиты
│   │   └── App.tsx
│   ├── index.html
│   └── package.json
├── bot/
│   ├── handlers/
│   ├── services/api_client.py
│   ├── config.py
│   └── main.py
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.{backend,frontend,bot}
│   └── nginx.conf (после деплоя)
├── .github/workflows/
├── .env.example
├── README.md
└── Дарси́-онлайн.pdf
```

---

## 12. Этапы реализации

| Этап | Период | Что делаем | Документ |
|------|--------|------------|----------|
| **1** | Неделя 1 | Фундамент: репо, Docker, FastAPI skeleton, Postgres, Alembic, Auth (SMS+Telegram), JWT, фронт-skeleton, бот-skeleton, README | [01-stage-foundation.md](01-stage-foundation.md) |
| **2** | Неделя 2 | Ядро родителя: дети, курсы (read), группы, запись, расписание, отметка «придёт/не придёт» | _скоро_ |
| **3** | Неделя 3 | Преподаватель + Telegram + материалы: курсы/группы CRUD, журнал занятий, материалы, ДЗ, рассылки, статистика | _скоро_ |
| **4** | Неделя 4 | Платежи, мероприятия, релиз: ЮKassa, события, тесты, деплой на Yandex Cloud | _скоро_ |

---

## 13. Открытые / отложенные вопросы

- Конкретные метрики Sentry alerting и SLO (после деплоя).
- Шаблоны SMS/Telegram-сообщений — финальный текст утверждать с заказчиком на этапе 3.
- Реквизиты ЮKassa и регистрация магазина самозанятого — нужны от заказчика к этапу 4.
- Точные тексты «Политики обработки ПД» и «Соглашения об использовании» — нужен юрист или шаблон от Робоцентра.
- Multi-tenant админка — после пилота.

---

## 14. Верификация (на каждом этапе)

- **Unit:** pytest, ≥70% покрытие сервисов.
- **Интеграционные:** TestClient FastAPI, контейнерный Postgres через testcontainers.
- **E2E:** Playwright — golden path по соответствующим этапу сценариям.
- **Telegram:** ручной прогон в `@DarsiTestBot`.
- **Адаптивность:** проверка на 360px, 768px, 1280px (Chrome DevTools).
- **ФЗ-152 чек-лист** — финальная проверка на этапе 4.
