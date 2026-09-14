# Управление пользователями

Пользователи хранятся в таблице `users` (модель `User` в Prisma). Каждый
пользователь — это один ключ доступа, по которому можно войти на `/login`.
В БД хранится **только bcrypt-хеш** ключа (`access_key_hash`), сам ключ не
хранится. Управлять пользователями можно через **Prisma Studio** или напрямую
**SQL**.

> **Важно.** В поле `access_key_hash` нельзя вставлять ключ в открытом виде —
> только его bcrypt-хеш. Иначе вход по этому ключу не сработает.

## Добавить пользователя

**Через Prisma Studio** (интерактивный UI):

```bash
cd services/logsink
npx prisma studio
```

В открывшемся UI выбрать модель `User` → **Add record** → заполнить
`access_key_hash` **bcrypt-хешем** ключа (остальные поля заполнятся
автоматически) → **Save**.

**Через SQL** (psql):

```bash
cd services/logsink
docker compose exec postgres psql -U logsink -d logsink
```

```sql
-- Вставить пользователя с bcrypt-хешем ключа.
-- Хеш можно получить, например, командой: node -e "console.log(require('bcryptjs').hashSync('новый-ключ', 12))"
INSERT INTO users (id, access_key_hash, created_at)
VALUES (gen_random_uuid(), '<bcrypt-хеш-ключа>', now());
```

> `gen_random_uuid()` доступен в PostgreSQL 13+ (встроенный). Если его нет —
> используйте `uuid_generate_v4()` после `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`.

## Удалить пользователя

**Через Prisma Studio:** выбрать модель `User` → найти нужную запись → **Delete**.

**Через SQL:**

```sql
-- Удалить пользователя по id (хеш ключа не позволяет искать по самому ключу)
DELETE FROM users WHERE id = '<id-пользователя>';
```

При удалении пользователя его сессии не удаляются, а отвязываются
(`user_id` становится `NULL`, `ON DELETE SET NULL`). Активные cookie-сессии
продолжат работать до истечения срока — при необходимости удалите их отдельно:

```sql
-- Удалить все сессии удалённого пользователя (по user_id)
DELETE FROM sessions WHERE user_id = '<id-пользователя>';
```

## Сменить ключ доступа

```sql
-- Заменить bcrypt-хеш ключа (хеш нового ключа получить командой выше)
UPDATE users SET access_key_hash = '<bcrypt-хеш-нового-ключа>' WHERE id = '<id-пользователя>';
```

> **Важно.** Ключ доступа — это пароль. Храните его в надёжном месте (менеджер
> паролей). После добавления/смены ключа через SQL/Studio он сразу становится
> валидным для входа на `/login`.
