# Архитектура

## Модель

Два независимых контура:

1. **Приём (OTLP/HTTP)** — `POST /v1/logs` и `POST /v1/traces` **без `session_id`**.
   Защита: проверка заголовка `Origin`/`Referer` — принимается только с hosts из
   allowlist `ALLOWED_ORIGINS` (env). Иначе `403`. Тело — protobuf-JSON по
   спецификации OTEL (`ExportLogsServiceRequest` / `ExportTraceServiceRequest`).
   Санитизация на сервере (редиакт secret/token/authorization/jwt/password,
   обрезка строк, лимит тела 1 МБ, ≤ 200 записей на батч). Ответ `200`.

2. **Просмотр** — по серверной сессии `session_id`, выдаваемой сервером в обмен на
   верный ключ доступа. В БД (таблица `users`) хранится **только bcrypt-хеш**
   ключа (`access_key_hash`), сам ключ не хранится. При первом запуске ключ
   берётся из `ACCESS_KEY` в `.env`, хешируется, создаётся пользователь, и
   `ACCESS_KEY` удаляется из `.env`. Авторизованный пользователь видит **все**
   логи и трейсы (изоляции нет).

## Авторизация просмотра

1. Открыть `/login`, ввести ключ доступа.
2. При первом запуске (в БД нет пользователей) ключ берётся из `ACCESS_KEY` в
   `.env`, **хешируется (bcrypt)**, создаётся пользователь в таблице `users`, и
   `ACCESS_KEY` удаляется из `.env`. В БД хранится только хеш ключа
   (`access_key_hash`), сам ключ не хранится.
3. При входе ключ сравнивается с хешем (`bcrypt.compare`). При совпадении сервер
   создаёт `session_id` в БД (привязан к пользователю) и ставит cookie
   (`HttpOnly`, `SameSite=Lax`, `Secure` в production).
4. Middleware защищает `/logs`: без валидной cookie — редирект на `/login`.
   Полная валидация сессии выполняется в серверном компоненте `/logs` через
   экземпляр сервиса (`logScopeService.isAuthorized()`).
5. Просмотр реализован на **серверном рендеринге**: страницы `/logs` и `/login` —
   серверные компоненты, использующие экземпляр сервиса. Интерактивные операции
   (вход, выход, фильтрация, пагинация) выполняются через **serverActions**
   (`src/shared/services/logScopeService/actions.ts`). Внутреннего REST API просмотра нет.

## Модель угроз

1. Ключ доступа — статический пароль для входа. В БД (таблица `users`) хранится
   **только bcrypt-хеш** ключа (`access_key_hash`), сам ключ не хранится — при
   утечке БД ключи не раскрываются. Кто знает ключ — получает доступ к просмотру
   всех логов и трейсов. `ACCESS_KEY` в `.env` используется только при первом
   запуске и затем удаляется.
2. `session_id` — серверная сессия (cookie). Компрометация cookie = доступ к просмотру
   до истечения срока.
3. OTLP-приём защищён allowlist `ALLOWED_ORIGINS` (проверка Origin). Это защита от
   посторонних сайтов, но не от прямых curl-запросов (Origin можно подделать). В
   продакшене поверх этого работает **rate limiting** на Caddy (см. ниже) и
   firewall, закрывающий порты приложения извне.
4. Санитизация на сервере обязательна — клиент недоверенный, может прислать секреты
   в `attributes`.
5. Cookie `session_id` — `HttpOnly`, `SameSite=Lax`, `Secure` в production.

## Продакшен-окружение

В продакшене сервис разворачивается как защищённый стек из трёх контейнеров
(см. [`docker-compose.prod.yml`](../docker-compose.prod.yml) и
[`docs/deployment.md`](deployment.md)):

- **Caddy** — единственная точка входа наружу. Rate limiting, security-заголовки,
  ограничение размера тела. TLS termination — только при наличии домена
  (`DOMAIN`): по IP работает HTTP (Let's Encrypt не выдаёт сертификаты на IP).
- **app** — не публикуется наружу, доступен только через Caddy во внутренней сети.
- **postgres** — в приватной (`internal`) сети, порт 5432 не публикуется наружу.

Защитные меры:

- **Rate limiting** (Caddy): OTLP-приём (60 req/мин/IP), `/login` (10 req/мин/IP,
  защита от brute-force), просмотр `/logs` (300 req/мин/IP).
- **Firewall** (ufw): наружу открыты только 22, 80, 443; 3000/5432 закрыты извне.
- **SSH только по ключу**: вход по паролю отключён (`ssh_hardening.sh`), защита
  от brute-force по SSH.
- **Хардненинг контейнеров**: non-root (`USER node`), `read_only: true`,
  `cap_drop: ALL`, `no-new-privileges`, ресурсные лимиты, healthcheck.
- **Секреты** вынесены в `.env.production` (не захардкожены в compose).

## Структура

```
services/logscope/
├── docker-compose.yml          # app + postgres (dev)
├── docker-compose.prod.yml     # caddy + app + postgres (prod, защищённый стек)
├── .env.example                # шаблон окружения (dev)
├── .env.production.example     # шаблон окружения (prod, секреты)
├── .npmrc                      # стандартный registry npm
├── .nvmrc                      # версия Node.js (20)
├── Dockerfile                  # сборка Next.js (standalone, non-root)
├── package.json                # зависимости, engines (Node 20+)
├── deploy/
│   ├── caddy/Caddyfile         # reverse proxy: TLS (по домену), rate limit, security-заголовки
│   ├── deploy.sh               # скрипт деплоя (проверка env + запуск стека)
│   ├── firewall.sh             # настройка ufw (только 22/80/443 наружу)
│   └── ssh_hardening.sh        # SSH только по ключу (без пароля)
├── docs/
│   ├── deployment.md           # руководство по развёртыванию в продакшен
│   └── ...                     # прочая документация
├── prisma/
│   ├── schema.prisma           # Session, LogEntry, Trace, Span
│   └── migrations/             # миграции
├── src/
│   ├── middleware.ts           # защита /logs; OTLP-приём публичный
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # редирект на /logs
│   │   ├── login/
│   │   │   ├── page.tsx        # серверный компонент (вход)
│   │   │   └── _ui/LoginForm.tsx
│   │   ├── logs/
│   │   │   ├── page.tsx        # серверный компонент (просмотр)
│   │   │   └── _ui/            # клиентские компоненты страницы
│   │   │       ├── LogsView.tsx
│   │   │       ├── LogTable.tsx
│   │   │       ├── LogFilters.tsx
│   │   │       ├── SessionList.tsx
│   │   │       ├── TraceList.tsx
│   │   │       └── TraceWaterfall.tsx
│   │   └── v1/
│   │       ├── logs/route.ts   # POST OTLP /v1/logs
│   │       └── traces/route.ts # POST OTLP /v1/traces
│   ├── shared/
│   │   ├── config.ts           # централизованная конфигурация (сессии, лимиты OTLP)
│   │   ├── lib/
│   │   │   └── prisma.ts       # клиент БД (Prisma)
│   │   └── services/           # сервисы по таблицам БД
│   │       ├── usersService/   # класс UsersService (таблица users)
│   │       ├── sessionsService/# класс SessionsService (таблица sessions)
│   │       ├── logsService/    # класс LogsService (таблица log_entries)
│   │       ├── tracesService/  # класс TracesService (таблицы traces/spans)
│   │       └── logScopeService/# оркестратор для UI
│   │           ├── service.ts  # класс LogScopeService (принимает сервисы в конструкторе)
│   │           ├── index.ts    # синглтон-экземпляр
│   │           ├── actions.ts  # serverActions
│   │           ├── types.ts    # типы, попадающие в UI
│   │           └── mappers/    # Prisma-модели → типы сервиса
│   └── lib/
│       ├── sanitize.ts         # серверная санитизация
│       ├── origin.ts           # проверка Origin
│       └── otel/               # конвертеры OTLP-приёма
```

## Команды

```bash
npm run dev              # dev-сервер
npm run build            # сборка (prisma generate + next build)
npm test                 # юнит-тесты OTLP-конвертеров
npm run prisma:migrate   # создать/применить миграции (dev)
npm run prisma:deploy    # применить миграции (prod)
npm run prisma:studio    # Prisma Studio
```
