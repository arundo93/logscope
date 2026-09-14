# Разработка и БД

Детали локальной разработки: развёртывание PostgreSQL (с Docker и без), запуск
dev-сервера и остановка БД. Краткая версия — в [README](../README.md).

## Запуск БД

Сервис полностью зависит от PostgreSQL: без запущенной БД не работают ни
миграции (`prisma migrate deploy`), ни dev-сервер (падает с
`P1001: Can't reach database server`). Поэтому перед разработкой БД обязательно
должна быть поднята.

### Вариант А — БД через Docker

Запускается только контейнер `postgres` (без app). Порт `5432` пробрасывается
на хост.

```bash
cd services/logsink
docker compose up -d postgres
```

### Вариант Б — БД без Docker

Docker для БД не обязателен — PostgreSQL можно развернуть локально, без
контейнеров. Это удобно, если Docker недоступен или нежелателен в окружении.

**macOS (Homebrew):**

```bash
# Установить PostgreSQL 16
brew install postgresql@16

# Запустить как фоновый сервис (автозапуск при входе в систему)
brew services start postgresql@16

# Создать пользователя и БД (логин/пароль/имя — как в DATABASE_URL)
createuser -s logsink
psql -d postgres -c "ALTER USER logsink WITH PASSWORD 'logsink';"
createdb -O logsink logsink
```

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql-16

# Запустить сервис
sudo systemctl start postgresql
# (опционально) автозапуск при загрузке системы
sudo systemctl enable postgresql

# Создать пользователя и БД
sudo -u postgres createuser -s logsink
sudo -u postgres psql -c "ALTER USER logsink WITH PASSWORD 'logsink';"
sudo -u postgres createdb -O logsink logsink
```

После этого `DATABASE_URL=postgresql://logsink:logsink@localhost:5432/logsink`
будет работать без Docker.

## Запуск dev-сервера

```bash
cd services/logsink

# 1. Установить зависимости
npm install

# 2. Настроить окружение (для локального запуска DATABASE_URL указывает на localhost)
cp .env.example .env
# DATABASE_URL=postgresql://logsink:logsink@localhost:5432/logsink
# задать ACCESS_KEY и ALLOWED_ORIGINS

# 3. Сгенерировать Prisma client и применить миграции
npx prisma generate
npx prisma migrate deploy

# 4. Запустить dev-сервер
npm run dev
```

Сервис будет доступен на http://localhost:3000.

> **Примечание.** Для локального запуска `DATABASE_URL` должен указывать на
> `localhost` (а не на `postgres`, как в docker-compose). Если PostgreSQL запущен
> через `docker compose up postgres`, порт `5432` проброшен на хост, и строка
> `postgresql://logsink:logsink@localhost:5432/logsink` подойдёт.

## Остановка БД

Чтобы БД не осталась работать навсегда, останавливайте её явно, когда она больше
не нужна.

### Если БД запущена через Docker

```bash
# Остановить контейнер postgres (контейнер остаётся, данные сохраняются)
docker compose stop postgres

# Полностью удалить контейнер (данные в volume сохраняются)
docker compose down postgres

# Полностью удалить контейнер вместе с volume (данные будут потеряны!)
docker compose down -v
```

### Если БД запущена локально (без Docker)

```bash
# macOS (Homebrew) — остановить сервис
brew services stop postgresql@16

# Ubuntu/Debian — остановить сервис
sudo systemctl stop postgresql
```

> **Совет.** Если вы запускали PostgreSQL через `brew services start` или
> `systemctl enable`, он будет автоматически стартовать при каждой загрузке
> системы. Чтобы этого избежать, отключите автозапуск:
>
> ```bash
> # macOS
> brew services stop postgresql@16   # останавливает и отключает автозапуск
>
> # Ubuntu/Debian
> sudo systemctl disable postgresql
> ```
>
> Для разовой разработки удобнее запускать БД вручную (без автозапуска), а после
> работы останавливать её командой выше.

## Диагностика

Если `npx prisma migrate deploy` падает с `P1001: Can't reach database server at
localhost:5432` — значит PostgreSQL не запущен. Убедитесь, что БД поднята:

```bash
# Docker
docker compose ps

# macOS (Homebrew)
brew services list

# Ubuntu/Debian
systemctl status postgresql
```

и порт `5432` доступен.
