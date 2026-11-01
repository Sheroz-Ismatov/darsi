# Дарси́

CRM для учебных центров, кружков, онлайн-школ и репетиторов: посещаемость, абонементы, оплаты, ДЗ.
Веб-панель для администрации школы и Telegram Mini App для преподавателей и родителей.

Документы: [ТЗ](TZ.md) · [Архитектура](ARCHITECTURE.md) · [План реализации](IMPLEMENTATION_PLAN.md) · [Дизайн-система](DESIGN_SYSTEM.md)

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
| `pnpm --filter @darsi/api db:migrate` | Миграции БД |

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
