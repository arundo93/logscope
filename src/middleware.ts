import { NextRequest, NextResponse } from "next/server";
import { isOriginAllowed } from "@/lib/origin";
import { SESSION_COOKIE_NAME } from "@/shared/services/sessionsService";

/**
 * Middleware защиты просмотра.
 *
 * Защищённые маршруты: /logs (страница просмотра).
 *
 * ВАЖНО: Next.js middleware выполняется в edge-рантайме, где нет доступа к
 * PrismaClient (требует Node.js). Поэтому здесь мы проверяем наличие cookie
 * session_id, а полную валидацию сессии в БД (существование + не истекла)
 * выполняет SessionsService в серверном коде.
 *
 * Без cookie страница /logs → редирект на /login.
 *
 * CORS: для запросов с разрешённым Origin (ALLOWED_ORIGINS) добавляются
 * Access-Control-* заголовки, а OPTIONS (preflight) завершается 204. Это нужно
 * для приёма OTLP-логов из браузера (fenestra → POST /v1/logs).
 */

const PROTECTED_PAGES = ["/logs"];

// Публичные POST-маршруты приёма (без session_id), защищены только проверкой
// Origin. OTLP-эндпоинты /v1/* — полностью публичные (только Origin).
const PUBLIC_POST_PATHS = ["/v1/logs", "/v1/traces"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // --- CORS ---
  // Для запросов с разрешённым Origin добавляем Access-Control-* заголовки.
  // OPTIONS (preflight) завершаем 204, чтобы браузер пропустил POST /v1/*.
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (origin || referer) {
    if (isOriginAllowed(origin, referer)) {
      const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": origin ?? referer ?? "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      };

      if (request.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: corsHeaders });
      }

      const response = NextResponse.next();
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    }
  }

  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  // Публичные POST-маршруты (приём логов) — пропускаем без проверки cookie.
  const isPublicPost = PUBLIC_POST_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isPublicPost && request.method === "POST") {
    return NextResponse.next();
  }

  if (!isProtectedPage) {
    return NextResponse.next();
  }

  // Если cookie отсутствует — редирект на /login.
  if (!sessionId) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie есть — пропускаем. Полная валидация сессии в БД выполняется
  // в серверном коде (страница /logs).
  return NextResponse.next();
}

export const config = {
  matcher: ["/logs/:path*", "/v1/:path*"],
};
