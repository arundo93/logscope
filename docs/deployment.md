# Развёртывание в продакшен

Logscope разворачивается как защищённый стек из трёх контейнеров:

```
                    ┌─────────────────────────────────────────────┐
                    │              Публичная сеть                 │
                    │                                             │
  Интернет ──► 80/443 ──► [ Caddy ] ──► 3000 ──► [ app ]          │
   (TLS*)             (reverse proxy,   (Next.js)                 │
                       rate limit,                                 │
                       security headers)                           │
                    └──────────────────────┬──────────────────────┘
                                           │
                    ┌──────────────────────▼──────────────────────┐
                    │              Приватная сеть (internal)      │
                    │                                             │
                    │              [ postgres ] 5432              │
                    │                                             │
                    └─────────────────────────────────────────────┘
```

\* TLS включается автоматически только при наличии домена (см. ниже).

- **Caddy** — единственная точка входа наружу. Делает rate limiting,
  security-заголовки, ограничение размера тела. TLS termination — только при
  наличии домена.
- **app** (Next.js) — не публикуется наружу, доступен только из публичной сети
  через Caddy.
- **postgres** — в приватной (`internal`) сети, порт 5432 не публикуется наружу.
  Caddy не имеет доступа к БД.

## Два режима доступа

Caddy поддерживает два режима, задаётся через `DOMAIN` в `.env.production`:

| Режим         | `DOMAIN` | Доступ             | TLS                |
| ------------- | -------- | ------------------ | ------------------ |
| **По IP**     | пуст     | `http://<IP>/`     | нет (HTTP)         |
| **По домену** | задан    | `https://<домен>/` | да (Let's Encrypt) |

> **Почему по IP нет TLS:** Let's Encrypt / ZeroSSL не выдают сертификаты на
> IP-адреса — только на домены. Поэтому при доступе по IP Caddy работает по
> HTTP (порт 80). Когда появится домен — задайте `DOMAIN`, и Caddy автоматически
> получит сертификат и включит HTTPS (80/443).

## Требования к серверу

- Linux (Ubuntu/Debian рекомендован), Docker + docker-compose v2.
- Открытые порты наружу: **80** (HTTP) и, при наличии домена, **443** (HTTPS).
  SSH (22) — для администрирования.
- Для HTTPS — домен, указывающий на IP сервера.

## Безопасный доступ по SSH (только по ключу)

Перед деплоем рекомендуется настроить вход на сервер **только по SSH-ключу**
(без пароля). Это защищает от brute-force-атак по паролю. Выбран вариант с
**ed25519-ключами** — он проще и надёжнее (короткий ключ, высокая стойкость,
поддержка во всех современных SSH-клиентах).

### 1. Сгенерировать ключ на своей машине (локально)

```bash
ssh-keygen -t ed25519 -a 100 -C "you@example.com" -f ~/.ssh/id_ed25519
```

- `-t ed25519` — тип ключа (рекомендуется).
- `-a 100` — число раундов KDF (защита ключа паролем).
- `-C` — комментарий (ваш email/логин).
- Задайте пароль на ключ (passphrase) — это защитит ключ при утечке файла.

### 2. Скопировать публичный ключ на сервер

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@<server-ip>
```

Если `ssh-copy-id` недоступен — вручную:

```bash
cat ~/.ssh/id_ed25519.pub | ssh user@<server-ip> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### 3. Проверить вход по ключу (из другого терминала!)

```bash
ssh -i ~/.ssh/id_ed25519 user@<server-ip>
```

Убедитесь, что вход работает **до** отключения паролей.

### 4. Отключить вход по паролю

```bash
sudo bash deploy/ssh_hardening.sh
```

Скрипт:

- проверяет, что ключ уже добавлен и вход по ключу работает (иначе не продолжит,
  чтобы не заблокировать доступ);
- отключает `PasswordAuthentication`, `ChallengeResponseAuthentication`, `UsePAM`;
- включает `PubkeyAuthentication`;
- запрещает root-вход по паролю (`PermitRootLogin prohibit-password`);
- проверяет синтаксис (`sshd -t`) и перезапускает `sshd`.

> **ВАЖНО:** держите открытой текущую SSH-сессию, пока не убедитесь, что вход по
> ключу работает из другого терминала. Если что-то пошло не так — восстановите
> доступ через открытую сессию.

### 5. (Опционально) Ограничить SSH источником в firewall

В [`deploy/firewall.sh`](../deploy/firewall.sh) замените строку `ufw allow 22/tcp`
на правило с вашим IP/подсетью:

```bash
ufw allow from 203.0.113.0/24 to any port 22 proto tcp comment 'SSH (restricted)'
```

## Шаги деплоя

### 1. Скопировать и заполнить продакшен-окружение

```bash
cd services/logscope
cp .env.production.example .env.production
```

Заполнить в `.env.production`:

| Переменная          | Что задать                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `DOMAIN`            | **Опционально.** Пусто → доступ по IP (`http://<IP>/`). Домен (например `logs.example.com`) → HTTPS  |
| `POSTGRES_PASSWORD` | Надёжный пароль БД: `openssl rand -base64 24`                                                        |
| `ACCESS_KEY`        | Ключ входа на `/login` (только буквы/цифры, без `$`): `openssl rand -hex 32`                         |
| `ALLOWED_ORIGINS`   | Origin клиентов (SPA), которые шлют логи. По IP: `http://<IP>`; по домену: `https://app.example.com` |

> **ВАЖНО:** `.env.production` содержит секреты. Убедитесь, что он добавлен в
> `.gitignore` (строка `.env.production`) и не попадает в репозиторий.

> **HSTS:** при появлении домена (HTTPS) дополнительно раскомментируйте блок
> HSTS в [`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile). При доступе по IP
> HSTS ставить нельзя — браузер закеширует его и будет блокировать HTTP.

### 2. Настроить firewall

```bash
sudo bash deploy/firewall.sh
```

Скрипт открывает наружу 22, 80, 443 и явно закрывает 3000/5432. Порт 443
используется только при наличии домена (HTTPS); при доступе по IP достаточно 80.

### 3. Запустить деплой

```bash
bash deploy/deploy.sh
```

Скрипт проверит обязательные переменные, соберёт образы и запустит стек.

### 4. Проверить

```bash
# Статус контейнеров
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Логи
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f caddy
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
```

- **По IP:** сервис доступен на `http://<IP-сервера>/`, вход — `/login` с `ACCESS_KEY`.
- **По домену:** сервис доступен на `https://<DOMAIN>/`, вход — `/login` с `ACCESS_KEY`.

## Rate limiting

Настроен в [`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile):

| Маршрут             | Лимит          | Назначение                                 |
| ------------------- | -------------- | ------------------------------------------ |
| `POST /v1/logs`     | 60 req/мин/IP  | Защита БД от перегрузки при приёме логов   |
| `POST /v1/traces`   | 60 req/мин/IP  | Защита БД от перегрузки при приёме трейсов |
| `POST /login`       | 10 req/мин/IP  | Защита от brute-force по ключу доступа     |
| `/logs*` (просмотр) | 300 req/мин/IP | Мягкий лимит, не мешает легитимной работе  |

При превышении возвращается `429 Too Many Requests`.

## Хардненинг контейнеров

- **non-root**: app запускается от пользователя `node` (см. `Dockerfile`).
- **read_only**: корневая ФС контейнеров монтируется только на чтение
  (`read_only: true`), запись — только в `tmpfs` (`/tmp`).
- **cap_drop: ALL**: у контейнеров отозваны все capabilities; у postgres
  добавлены только минимально необходимые.
- **no-new-privileges**: запрещено повышение привилегий.
- **Ресурсные лимиты**: память и CPU ограничены через `deploy.resources`.
- **Healthcheck**: у всех контейнеров есть проверки здоровья.

## Обновление

```bash
cd services/logscope
bash deploy/deploy.sh   # пересоберёт образы и перезапустит стек
```

## Откат

```bash
# Остановить (данные в volume сохраняются)
docker compose -f docker-compose.prod.yml --env-file .env.production down

# Полностью удалить вместе с данными (осторожно!)
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
```

## Резервное копирование БД

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec postgres pg_dump -U logscope logscope > backup_$(date +%F).sql
```
