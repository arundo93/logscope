/**
 * Общие утилиты OTLP-приёма: проверка Origin, лимиты тела, парсинг JSON.
 *
 * Используется роутами POST /v1/logs и POST /v1/traces.
 */

import { NextRequest, NextResponse } from "next/server";
import { isOriginAllowed } from "@/lib/origin";
import { config } from "@/shared/config";

/**
 * Проверяет Origin/Referer против ALLOWED_ORIGINS.
 * Возвращает 403-ответ или null, если запрос разрешён.
 */
export function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!isOriginAllowed(origin, referer)) {
    return NextResponse.json({ error: "origin not allowed" }, { status: 403 });
  }
  return null;
}

/**
 * Читает и парсит JSON-тело с проверкой лимита размера.
 * Возвращает { ok: true, data } или { ok: false, response }.
 */
export async function parseJsonBody(
  request: NextRequest,
): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > config.openTelemetry.maxBodyBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "request body too large" },
        { status: 413 },
      ),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid body" }, { status: 400 }),
    };
  }

  if (Buffer.byteLength(text, "utf8") > config.openTelemetry.maxBodyBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "request body too large" },
        { status: 413 },
      ),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid JSON body" },
        { status: 400 },
      ),
    };
  }
}
