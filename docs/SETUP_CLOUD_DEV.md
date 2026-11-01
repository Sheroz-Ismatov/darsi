# Облачные базы для разработки: Neon + Upstash

Бесплатно, без Docker. Регион обоих сервисов — **Франкфурт** (ближе всего к Душанбе).
Строки подключения — это пароли: вставляйте их только в файл `.env` в корне проекта (он не попадает в git) и никому не пересылайте.

## 1. Neon — PostgreSQL

1. Откройте https://neon.tech → **Sign up** (удобно через Google или GitHub).
2. **Create project**:
   - Project name: `darsi`
   - Postgres version: **16**
   - Region: **AWS Europe Central 1 (Frankfurt)**
   - Database name: `darsi`
3. На главной странице проекта нажмите **Connect**. Откроется окно со строкой подключения:
   - Включите переключатель **Connection pooling** → скопируйте строку (в адресе будет `-pooler`) → это **`DATABASE_URL`**.
   - Выключите **Connection pooling** → скопируйте строку (без `-pooler`) → это **`DIRECT_URL`**.
   - Обе строки заканчиваются на `?sslmode=require` — так и должно быть.
4. Слева **Databases** → **New database** → имя `darsi_test` → **Create**.
   Снова **Connect**, в выпадающем списке **Database** выберите `darsi_test`, **пулинг выключен** (без `-pooler`) → строка → **`DATABASE_URL_TEST`**.
   Тесты применяют к этой базе миграции, а через пулер они не работают.

## 2. Upstash — Redis

1. Откройте https://upstash.com → **Sign up**.
2. **Redis** → **Create Database**:
   - Name: `darsi`
   - Primary region: **Frankfurt (eu-central-1)**
   - Plan: **Free**
   - Eviction: выключено
3. На странице базы найдите блок **Connect** → вкладка с адресом вида
   `rediss://default:<пароль>@<имя>.upstash.io:6379` (обратите внимание: `rediss` с двумя «s» — это шифрованное соединение) → это **`REDIS_URL`**.
   Если показан только пароль и хост — соберите строку сами по этому шаблону.

## 3. Файл `.env`

Откройте `.env` в корне проекта и замените строки (остальное не трогайте):

```
DATABASE_URL=postgresql://...-pooler...neon.tech/darsi?sslmode=require
DIRECT_URL=postgresql://...neon.tech/darsi?sslmode=require
DATABASE_URL_TEST=postgresql://...neon.tech/darsi_test?sslmode=require
REDIS_URL=rediss://default:...@....upstash.io:6379
```

Сохраните файл и напишите в чат «готово» — проверю подключение через `GET /api/v1/health`.

## Ограничения бесплатных тарифов

- Neon засыпает после ~5 минут простоя; первый запрос после этого — около секунды.
- Upstash ограничивает число команд в месяц; фоновый воркер в разработке запускаем только когда нужен.
- Это только для разработки. В продакшне PostgreSQL и Redis будут на своём сервере.
