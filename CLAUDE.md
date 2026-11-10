# Дарси́ — правила проекта для Claude

CRM для учебных центров: веб-панель (владелец, админ, суперадмин) и Telegram Mini App (преподаватель, родитель).
Документы: [TZ.md](TZ.md) — что делаем, [ARCHITECTURE.md](ARCHITECTURE.md) — как устроено,
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — внешний вид, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — задачи и статусы.

**Если тебя попросили выполнить задачу T-NN** — сначала прочитай [docs/tasks/README.md](docs/tasks/README.md) (регламент),
потом бриф задачи в `docs/tasks/`. Бриф важнее общих документов: в нём уже приняты решения по спорным местам.

## Язык

- С пользователем, в документах и сообщениях коммитов — по-русски.
- Код, идентификаторы и комментарии в коде — по-английски. Комментарий объясняет «почему», а не «что».
- Тексты интерфейса — только через i18n, без строк в компонентах.

## Структура

```
apps/api      NestJS 11 (CJS), Prisma 6, zod 4, Vitest 5. src/modules/*, src/common/*, prisma/, test/
apps/web      React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind 4. Панель, только русский
apps/tma      то же, Telegram Mini App, русский и таджикский
packages/shared   контракты (zod), domain (чистые функции), i18n (ru, tg), константы. Собирается tsup
packages/ui       компоненты дизайн-системы и токены
```

## Обязательные правила кода

- **Изоляция школ.** Любой запрос к данным школы идёт через `@SchoolRoles(...)` и `@CurrentSchool()`, и каждый запрос Prisma
  фильтруется по `schoolId`. Чужая запись — 404, а не 403. У суперадмина нет неявного доступа к данным школ.
  Каждый новый эндпоинт школы добавляется в `describeSchoolIsolation` (см. `apps/api/test/tenancy.e2e-spec.ts`).
- **Контракты** запросов и ответов — в `packages/shared/src/contracts`: zod-схема запроса и тип ответа. API проверяет вход
  через `ZodValidationPipe`, веб проверяет форму той же схемой. id в пути — через `idParamSchema`.
- **Ошибки** — `AppError(code, message, status, details)`. `code` — стабильный ключ в ВЕРХНЕМ_РЕГИСТРЕ, клиент переводит
  его сам. Тексты ошибок для панели — `apps/web/src/app/locales/ru.ts`, раздел `errors`.
- **Деньги** — `BigInt` в минимальных единицах, в JSON строкой. **Время** — `timestamptz` в UTC; показываем в часовом поясе
  школы, а не браузера. Даты без времени — тип `date`.
- **Аудит.** Изменения ролей, настроек, абонементов, посещений, оплат пишутся в `AuditLog` (кто, что было, что стало).
- **Логи без персональных данных:** ни имён, ни телефонов, ни токенов.
- **Словари.** Тексты Mini App и бота — в `packages/shared/src/i18n/{ru,tg}.ts`, ключи в обоих файлах одинаковые
  (тип `Dictionary` не даст собрать иначе). Тексты панели — только в `apps/web/src/app/locales/ru.ts`.
- **Интерфейс** собирается из `@darsi/ui` и токенов темы. Новых цветов, радиусов и шрифтов не вводим. Образец вида —
  прототип `design/sample` (конфигурация `design-sample` в `.claude/launch.json`), соответствие экранов — DESIGN_SYSTEM.md §6.
- Не добавляй зависимость, если хватает 30 строк своего кода. Новую зависимость закрепляй точной версией, которая
  реально есть в реестре (у нас уже были 404 на свежих версиях).

## Команды

Машина разработки слабая (4 ГБ ОЗУ, Windows): процессы иногда падают с кодом 5 или `0xC0000005`. Это не ошибка кода —
**повтори ту же команду**, до трёх раз. Запускать инструменты напрямую через `node` надёжнее, чем через `pnpm`:

| Что | Где | Команда |
|---|---|---|
| Сборка shared (нужна после любой правки в нём — API берёт `dist`) | корень | `pnpm --filter @darsi/shared build` |
| Клиент Prisma | `apps/api` | `node node_modules/prisma/build/index.js generate` |
| Типы API | `apps/api` | `node node_modules/typescript/bin/tsc -p tsconfig.test.json` |
| Типы web / tma / ui / shared | папка пакета | `node node_modules/typescript/bin/tsc --noEmit` |
| Тесты API (все, ~3 мин) | `apps/api` | `node node_modules/vitest/vitest.mjs run` |
| Один файл тестов | `apps/api` | `node node_modules/vitest/vitest.mjs run test/platform.e2e-spec.ts` |
| Линтер | корень | `node node_modules/eslint/bin/eslint.js .` |
| Форматирование | корень | `node node_modules/prettier/bin/prettier.cjs --write .` (проверка: `--check .`) |
| Сборка API | `apps/api` | `node node_modules/@nestjs/cli/bin/nest.js build` |
| Сборка web | `apps/web` | `node node_modules/vite/bin/vite.js build` |

Серверы для проверки в браузере — только через `.claude/launch.json` (`api-dev-login`, `web`, `tma`), не через shell.
`api-dev-login` запускает собранный API (`dist`) с входом для разработки и выключенным ботом — перед запуском собери API.

## База данных

Облачный Postgres (Neon). База «засыпает»: первая команда после паузы может упасть с `P1001` — повтори.

Миграции (никогда не `migrate dev` и не `migrate reset`):

1. Измени `apps/api/prisma/schema.prisma`.
2. В `apps/api` получи SQL:
   `node node_modules/prisma/build/index.js migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/<ГГГГММДДччммсс>_<имя>/migration.sql`
3. Прочитай SQL. Частичные уникальные индексы и прочее, чего нет в Prisma, допиши руками в тот же файл.
4. Примени к базе разработки: `node node_modules/prisma/build/index.js migrate deploy`.
5. Примени к тестовой: `node scripts/prisma-test.mjs migrate deploy`.
6. Перегенерируй клиент.

Старые миграции не редактируются. Удаление или переименование столбца с данными — только после согласования с пользователем.

## Запрещено без прямого разрешения пользователя

- Читать, печатать, менять или коммитить `.env`. Нужна новая переменная — добавь её в `.env.example` и в
  `apps/api/src/common/config/env.ts`, а пользователю скажи, что дописать у себя.
- `prisma migrate reset`, удаление данных в базе разработки, `git push`, `git reset --hard`, правка истории.
- Завершать процессы, которые запустил не ты; открывать туннели.
- Менять TZ.md, ARCHITECTURE.md и чужие брифы. Нашёл противоречие — остановись и напиши пользователю.

## Git

Одна задача — одна ветка `feat/t-NN-кратко` от свежего `main` и один коммит. Автор уже настроен в репозитории.
Сообщение: `T-NN: что сделано` и список по слоям, в конце строка `Co-Authored-By: Claude <noreply@anthropic.com>`.
Сообщение пиши в файл и передавай через `git commit -F <файл>` (here-string в PowerShell здесь не работает).
Запись в `.git` из песочницы может не пройти — тогда выполни ту же git-команду без песочницы.
