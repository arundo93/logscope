import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

/**
 * Сервис работы с таблицей log_entries (LogEntry).
 */
export class LogsService {
  /** Список логов с пагинацией. Возвращает { items, total }. */
  async findMany(params: {
    where: Prisma.LogEntryWhereInput;
    orderBy: Prisma.LogEntryOrderByWithRelationInput;
    page: number;
    pageSize: number;
  }) {
    const { where, orderBy, page, pageSize } = params;
    const [items, total] = await Promise.all([
      prisma.logEntry.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.logEntry.count({ where }),
    ]);
    return { items, total };
  }

  /** Массовая вставка логов (OTLP-приём). */
  async createMany(data: Prisma.LogEntryCreateManyInput[]): Promise<void> {
    await prisma.logEntry.createMany({ data });
  }
}
