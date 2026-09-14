import { PrismaClient } from "@prisma/client";

/**
 * Клиент БД (Prisma).
 *
 * Синглтон PrismaClient для избежания множественных подключений в dev-режиме
 * (Next.js hot-reload создаёт новый модуль при каждой перезагрузке).
 * Сервисы (src/shared/services/*) используют этот клиент для работы с БД.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
