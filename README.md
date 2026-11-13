# Дарси́

CRM для учебных центров, кружков, онлайн-школ и репетиторов: посещаемость, абонементы, оплаты, ДЗ.
Веб-панель для администрации школы и Telegram Mini App для преподавателей и родителей.

Документы: [ТЗ](TZ.md) · [Архитектура](ARCHITECTURE.md) · [План реализации](IMPLEMENTATION_PLAN.md) · [Дизайн-система](DESIGN_SYSTEM.md)

## Документация онлайн

ТЗ, архитектура, план, брифы задач и прототип дизайна публикуются на GitHub Pages
([.github/workflows/docs.yml](.github/workflows/docs.yml)) при каждом пуше в `main`, который меняет документы.
Адрес: `https://<владелец>.github.io/<репозиторий>/`.

- Включить один раз: в репозитории Settings → Pages → Source: **GitHub Actions**. Для приватного репозитория
  Pages доступны только на платном тарифе GitHub — иначе сделайте репозиторий публичным или читайте документы
  прямо на GitHub.
- Новый бриф в `docs/tasks/T-NN-*.md` попадает в меню сам, ничего править не нужно.
- Посмотреть локально: `node docs/site/build.mjs`, затем `python -m http.server 5600 --directory _site`
  и открыть `http://localhost:5600`.

> Проект в разработке — этап 0 (фундамент). Полная инструкция по запуску и деплою появится в T-41.

## Требования

- Node.js 24 (`.node-version`), pnpm 10
- PostgreSQL 16 и Redis 7 — через `infra/docker-compose.yml` или внешние сервисы (см. `.env`)

## Быстрый старт

```bash
pnpm install          # зависимости + генерация клиента Prisma
cp .env.example .env  # заполнить JWT_SECRET и адреса БД (см. ниже)
pnpm --filter @darsi/api dev
```

PostgreSQL и Redis — один из двух вариантов:

- **Облако (по умолчанию для разработки, бесплатно):**
  [Neon](https://neon.tech) — в `.env` `DATABASE_URL` (строка с `-pooler`), `DIRECT_URL` (без `-pooler`), `DATABASE_URL_TEST` (отдельная база `darsi_test`);
  [Upstash Redis](https://upstash.com) — `REDIS_URL=rediss://…`. Регион обоих — Франкфурт (ближе всего к Душанбе).
- **Docker:** `pnpm infra:up` поднимает PostgreSQL, Redis и MinIO по [infra/docker-compose.yml](infra/docker-compose.yml) (нужно ≥ 8 ГБ ОЗУ).

Проверка: `GET http://localhost:3000/api/v1/health` → `200 {"status":"ok"}` (503, если БД или Redis недоступны).

## Команды

| Команда | Что делает |
|---|---|
| `pnpm build` | Сборка всех пакетов |
| `pnpm test` | Тесты всех пакетов |
| `pnpm typecheck` | Проверка типов |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm infra:up` / `pnpm infra:down` | Локальные сервисы в Docker |
| `pnpm --filter @darsi/api db:migrate` | Создать и применить миграцию (dev-база) |
| `pnpm --filter @darsi/api db:seed` | Тариф «Пилот», демо-школа; суперадмин — если задан `SEED_SUPERADMIN_TELEGRAM_ID` |
| `pnpm --filter @darsi/api db:test:prepare` | Применить миграции к тестовой базе (`DATABASE_URL_TEST`) перед `pnpm test` |
| `pnpm --filter @darsi/api db:test:reset` | Полностью очистить тестовую базу (запускать вручную) |

## Вход в разработке

- Mini App: Telegram передаёт `initData`, API проверяет подпись токеном бота (`BOT_TOKEN`).
- Веб-панель: Telegram Login Widget работает только на домене, привязанном в @BotFather (`/setdomain`), поэтому локально
  используется `POST /api/v1/auth/dev-login` с `{"telegramId": <id>}` — только при `AUTH_DEV_BYPASS=true` и не в production.
  На странице входа (`localhost:5173/login`) в режиме разработки есть форма «Вход для разработки»: введите Telegram ID.
  ID из `SEED_SUPERADMIN_TELEGRAM_ID` открывает раздел «Школы» (суперадмин). Аккаунт без роли владельца или
  администратора видит экран «Нет доступа».

## Mini App в Telegram (разработка)

Telegram открывает Mini App только по публичному HTTPS-адресу. Один туннель отдаёт и приложение, и API
(Vite проксирует `/api` на `localhost:3000`).

1. Один раз: `winget install --id Cloudflare.cloudflared`.
2. `pnpm --filter @darsi/tma dev` — Mini App на `localhost:5174`.
3. `pnpm tunnel:tma` — в выводе появится адрес `https://<слова>.trycloudflare.com`.
4. В `.env`: `TMA_URL=<этот адрес>`, `BOT_MODE=polling`.
5. `pnpm --filter @darsi/api dev` — API и бот; при старте бот ставит кнопку меню «Дарси».
6. В Telegram откройте бота → `/start` → «Открыть Дарси».

Адрес quick-туннеля меняется при каждом запуске — после перезапуска туннеля обновите `TMA_URL` и перезапустите API.

## Структура

```
apps/api         NestJS API
packages/shared  общие константы, контракты, доменные правила
infra/           docker-compose для разработки
design/sample    прототип — эталон визуального стиля
```

## Известные ограничения среды разработки

На машинах с 4 ГБ ОЗУ процессы Node могут падать с `0xC0000005` при нехватке памяти — повторите команду.
Тесты API запускаются в пуле `threads`, без дочерних процессов, по той же причине.
