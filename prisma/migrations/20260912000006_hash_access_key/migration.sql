-- AlterTable: переименовать access_key в access_key_hash (bcrypt-хеш ключа доступа).
-- Сам ключ доступа в БД больше не хранится — только его bcrypt-хеш.
ALTER TABLE "users" RENAME COLUMN "access_key" TO "access_key_hash";

-- DropIndex: старый уникальный индекс по access_key
DROP INDEX "users_access_key_key";

-- CreateIndex: уникальный индекс по access_key_hash
CREATE UNIQUE INDEX "users_access_key_hash_key" ON "users"("access_key_hash");