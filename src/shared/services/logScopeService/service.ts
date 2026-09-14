import { Prisma } from "@prisma/client";
import { UsersService } from "@/shared/services/usersService";
import { SessionsService } from "@/shared/services/sessionsService";
import { LogsService } from "@/shared/services/logsService";
import { TracesService } from "@/shared/services/tracesService";
import { toLogItem, toTraceItem, toTraceDetail } from "./mappers";
import type {
  LogsQuery,
  TracesQuery,
  Paginated,
  LogItem,
  TraceItem,
  TraceDetail,
  LoginResult,
} from "./types";

/**
 * Сервис LogScope — оркестратор для UI.
 *
 * Принимает в конструкторе сервисы по таблицам (usersService, sessionsService,
 * logsService, tracesService) и использует их для реализации бизнес-логики
 * просмотра и авторизации. Наружу отдаёт только типы сервиса
 * (src/shared/services/logScopeService/types), которые попадают в UI.
 *
 * Экземпляр создаётся один раз (см. index.ts) и используется в серверных
 * компонентах и serverActions (actions.ts).
 */
export class LogScopeService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly logsService: LogsService,
    private readonly tracesService: TracesService,
  ) {}

  // --- Авторизация ---

  /** Возвращает валидный session_id из cookie или null. */
  async getCurrentSessionId(): Promise<string | null> {
    return this.sessionsService.getCurrentSessionId();
  }

  /** Проверяет, авторизован ли текущий запрос. */
  async isAuthorized(): Promise<boolean> {
    return this.sessionsService.isAuthorized();
  }

  /**
   * Вход по ключу доступа. При первом запуске создаёт пользователя из
   * ACCESS_KEY в .env. При успехе создаёт сессию и ставит cookie.
   */
  async login(accessKey: string): Promise<LoginResult> {
    // Первый запуск: если в БД нет пользователей, создаём из ACCESS_KEY в .env.
    await this.usersService.bootstrapFromEnv();

    const user = await this.usersService.findByAccessKey(accessKey);
    if (!user) {
      return { ok: false, error: "invalid access key" };
    }

    const session = await this.sessionsService.createSessionForUser(user.id);
    if (!session.ok) {
      return { ok: false, error: session.error };
    }

    return { ok: true };
  }

  /** Выход: удаляет сессию из БД и сбрасывает cookie. */
  async logout(): Promise<void> {
    await this.sessionsService.logout();
  }

  // --- Просмотр логов ---

  /** Список логов с фильтрами и пагинацией. */
  async getLogs(query: LogsQuery): Promise<Paginated<LogItem>> {
    const where: Prisma.LogEntryWhereInput = {};

    if (query.level) {
      where.level = query.level;
    }

    // Фильтры по атрибутам логов (additionals). Применяются как AND.
    if (query.attributes?.length) {
      where.AND = query.attributes
        .filter((a) => a.key.trim() && a.value.trim())
        .map(({ key, value }) => {
          const path = key
            .split(".")
            .map((p) => p.trim())
            .filter(Boolean);
          const trimmed = value.trim();
          // Если значение — число, сравниваем строго (equals), иначе — подстрока.
          const numeric = Number(trimmed);
          const isNumeric = trimmed !== "" && !Number.isNaN(numeric);
          return {
            additionals: {
              path,
              ...(isNumeric
                ? { equals: numeric }
                : { string_contains: trimmed }),
            },
          };
        });
    }

    if (query.q) {
      where.message = { contains: query.q, mode: "insensitive" };
    }

    if (query.traceId) {
      where.traceId = query.traceId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const orderBy: Prisma.LogEntryOrderByWithRelationInput = {
      createdAt: query.sort,
    };

    const { items, total } = await this.logsService.findMany({
      where,
      orderBy,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map(toLogItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // --- Просмотр трейсов ---

  /** Список трейсов с пагинацией. */
  async getTraces(query: TracesQuery): Promise<Paginated<TraceItem>> {
    const where: Prisma.TraceWhereInput = {};

    if (query.q) {
      where.OR = [
        { traceId: { contains: query.q, mode: "insensitive" } },
        { name: { contains: query.q, mode: "insensitive" } },
      ];
    }

    if (query.from || query.to) {
      where.startTime = {};
      if (query.from) where.startTime.gte = new Date(query.from);
      if (query.to) where.startTime.lte = new Date(query.to);
    }

    const orderBy: Prisma.TraceOrderByWithRelationInput = {
      startTime: query.sort,
    };

    const { items, total } = await this.tracesService.findMany({
      where,
      orderBy,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map(toTraceItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Полный трейс (агрегат + спаны) или null, если не найден. */
  async getTrace(traceId: string): Promise<TraceDetail | null> {
    const { trace, spans } =
      await this.tracesService.findTraceWithSpans(traceId);
    if (!trace) return null;
    return toTraceDetail(trace, spans);
  }
}
