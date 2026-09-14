import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/shared/lib/prisma";

export const SESSION_COOKIE_NAME = "session_id";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Сервис работы с таблицей sessions (серверные сессии просмотра)
 * и cookie session_id.
 */
export class SessionsService {
  /** Edge-safe: читает session_id из cookie запроса (для middleware). */
  static getSessionIdFromRequest(request: NextRequest): string | undefined {
    return request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  private static readSessionId(store: CookieStore): string | undefined {
    return store.get(SESSION_COOKIE_NAME)?.value;
  }

  private static writeSessionCookie(
    store: CookieStore,
    sessionId: string,
    expiresAt: Date,
  ): void {
    const isProd = process.env.NODE_ENV === "production";
    store.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      expires: expiresAt,
    });
  }

  private static clearSessionCookie(store: CookieStore): void {
    store.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  /** Находит сессию по session_id. */
  async findBySessionId(sessionId: string) {
    return prisma.session.findUnique({ where: { sessionId } });
  }

  /** Создаёт сессию. */
  async create(data: {
    sessionId: string;
    expiresAt: Date;
    userId?: string | null;
  }) {
    return prisma.session.create({
      data: {
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        userId: data.userId ?? null,
      },
    });
  }

  /** Удаляет сессию по id. */
  async deleteById(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } }).catch(() => {});
  }

  /** Удаляет все сессии по session_id. */
  async deleteBySessionId(sessionId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { sessionId } }).catch(() => {});
  }

  /** Обновляет last_seen_at сессии (не блокирует при ошибке). */
  async touch(id: string): Promise<void> {
    await prisma.session
      .update({
        where: { id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});
  }

  /** Список всех сессий, новые сверху. */
  async findMany() {
    return prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        sessionId: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
  }

  /**
   * Возвращает валидный session_id из cookie или null.
   * Обновляет last_seen_at при успехе.
   */
  async getCurrentSessionId(): Promise<string | null> {
    const sessionId = SessionsService.readSessionId(await cookies());
    if (!sessionId) return null;

    const session = await this.findBySessionId(sessionId);
    if (!session) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      await this.deleteById(session.id);
      return null;
    }

    await this.touch(session.id);
    return session.sessionId;
  }

  /** Проверяет, авторизован ли текущий запрос. */
  async isAuthorized(): Promise<boolean> {
    return (await this.getCurrentSessionId()) !== null;
  }

  /**
   * Создаёт сессию для пользователя и ставит cookie.
   * Вызывается после успешной проверки ключа доступа.
   */
  async createSessionForUser(
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await this.create({
        sessionId,
        expiresAt,
        userId,
      });
    } catch (err) {
      console.error("Failed to create session:", err);
      return { ok: false, error: "internal error" };
    }

    SessionsService.writeSessionCookie(await cookies(), sessionId, expiresAt);
    return { ok: true };
  }

  /** Выход: удаляет сессию из БД и сбрасывает cookie. */
  async logout(): Promise<void> {
    const store = await cookies();
    const sessionId = SessionsService.readSessionId(store);

    if (sessionId) {
      await this.deleteBySessionId(sessionId);
    }

    SessionsService.clearSessionCookie(store);
  }
}
