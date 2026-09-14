# Logscope — OTEL-бэкенд для логов и трейсов

Сервис принимает логи и трейсы по стандарту **OpenTelemetry (OTLP/HTTP, JSON)**,
предоставляет веб-интерфейс для просмотра

**Стек:** Next.js 15 (App Router, TypeScript) · PostgreSQL 16 · Prisma · Zod · docker-compose.

## Требования

- **Node.js 20+** (LTS). Версия зафиксирована в [`.nvmrc`](.nvmrc) и `engines` в
  [`package.json`](package.json). Для установки нужной версии:
  ```bash
  nvm use   # если используется nvm
  ```
- **Docker + docker-compose** — для запуска через `docker compose` (рекомендуется).

## Быстрый старт (Docker)

```bash
# 1. Настроить окружение
cp .env.example .env
# отредактировать ACCESS_KEY и ALLOWED_ORIGINS

# 2. Запустить app + postgres
docker compose up --build
```

После запуска:

- Веб-интерфейс: http://localhost:3000
- Вход: http://localhost:3000/login (ввести `ACCESS_KEY`)
- Просмотр логов и трейсов: http://localhost:3000/logs

### Остановка (Docker)

```bash
# Остановить контейнеры (данные в volume сохраняются)
docker compose stop

# Полностью удалить контейнеры (данные в volume сохраняются)
docker compose down

# Полностью удалить контейнеры вместе с volume (данные будут потеряны!)
docker compose down -v
```

## Продакшен-деплой

Для развёртывания в продакшен используется стек из трёх контейнеров
(`docker-compose.prod.yml`): **Caddy** (reverse proxy, rate limiting) +
**app** + **postgres** (в приватной сети). Подробное руководство — в
[`docs/deployment.md`](docs/deployment.md).

Доступ возможен в двух режимах (задаётся через `DOMAIN` в `.env.production`):

- **По IP** — `DOMAIN` пуст: сервис доступен по `http://<IP>/` (HTTP, без TLS).
- **По домену** — `DOMAIN=logs.example.com`: сервис доступен по `https://<домен>/`
  (Caddy автоматически получает TLS-сертификат).

```bash

# 1. Настроить продакшен-окружение (секреты)
touch .env.production
# отредактировать ACCESS_KEY, POSTGRES_PASSWORD, ALLOWED_ORIGINS
# (DOMAIN — опционально: пусто = доступ по IP, задан = HTTPS по домену)

# 2. Настроить firewall (от root): открыть только 22/80/443
sudo bash deploy/firewall.sh

# 3. Запустить деплой
bash deploy/deploy.sh
```

Ключевые меры безопасности продакшен-окружения:

- **Reverse proxy (Caddy)** — единственная точка входа наружу, TLS termination
  (при наличии домена), security-заголовки, ограничение размера тела.
- **Rate limiting** — OTLP-приём (60 req/мин/IP), `/login` (10 req/мин/IP,
  защита от brute-force), просмотр (300 req/мин/IP).
- **Firewall (ufw)** — наружу открыты только 22, 80, 443; порты app (3000) и
  postgres (5432) закрыты извне.
- **Хардненинг контейнеров** — non-root, `read_only`, `cap_drop: ALL`,
  `no-new-privileges`, ресурсные лимиты, healthcheck.
- **Секреты** вынесены в `.env.production` (не захардкожены в compose).

## Локальная разработка (без Docker)

Для разработки сервис запускается локально. Понадобится запущенный PostgreSQL —
либо через Docker (только БД), либо локальной установкой без Docker.

### 1. Запустить БД

**Вариант А — БД через Docker** (только контейнер `postgres`, без app):

```bash

docker compose up -d postgres
```

**Вариант Б — БД без Docker** (локальная установка PostgreSQL):

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16
createuser -s logsink
psql -d postgres -c "ALTER USER logsink WITH PASSWORD 'logsink';"
createdb -O logsink logsink

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-16
sudo systemctl start postgresql
sudo -u postgres createuser -s logsink
sudo -u postgres psql -c "ALTER USER logsink WITH PASSWORD 'logsink';"
sudo -u postgres createdb -O logsink logsink
```

> **Почему БД обязательна.** Сервис полностью зависит от PostgreSQL: без
> запущенной БД не работают ни миграции (`prisma migrate deploy`), ни dev-сервер
> (падает с `P1001: Can't reach database server`). Поэтому перед разработкой БД
> обязательно должна быть поднята.

### 2. Установить зависимости и настроить окружение

```bash


npm install

cp .env.example .env
# DATABASE_URL=postgresql://logsink:logsink@localhost:5432/logsink
# задать ACCESS_KEY и ALLOWED_ORIGINS
```

> Для локального запуска `DATABASE_URL` должен указывать на `localhost` (а не на
> `postgres`, как в docker-compose). Если PostgreSQL запущен через
> `docker compose up postgres`, порт `5432` проброшен на хост, и строка
> `postgresql://logsink:logsink@localhost:5432/logsink` подойдёт.

### 3. Применить миграции и запустить dev-сервер

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Сервис будет доступен на http://localhost:3000.

> Если `npx prisma migrate deploy` падает с `P1001: Can't reach database server at
localhost:5432` — значит PostgreSQL не запущен. Убедитесь, что БД поднята
> (`docker compose ps` для Docker, `brew services list` / `systemctl status postgresql`
> для локальной установки) и порт `5432` доступен.

### Остановка БД

Чтобы БД не осталась работать навсегда, останавливайте её явно, когда она больше
не нужна.

**Если БД запущена через Docker:**

```bash
# Остановить контейнер postgres (контейнер остаётся, данные сохраняются)
docker compose stop postgres

# Полностью удалить контейнер (данные в volume сохраняются)
docker compose down postgres

# Полностью удалить контейнер вместе с volume (данные будут потеряны!)
docker compose down -v
```

**Если БД запущена локально (без Docker):**

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

## Документация

- [Разработка и БД](docs/development.md) — детали локальной разработки, развёртывание и остановка БД
- [Конфигурация](docs/configuration.md) — переменные окружения
- [Использование](docs/usage.md) — отправка логов/трейсов (curl), интеграция с клиентом
- [Архитектура](docs/architecture.md) — модель, авторизация, модель угроз, структура
- [Развёртывание в продакшен](docs/deployment.md) — защищённый стек, firewall, rate limiting, деплой
- [Управление пользователями](docs/users.md) — добавление/удаление/смена ключа доступа
- [API](docs/api.md) — документация API
