import { NextRequest, NextResponse } from "next/server";
import { logsService } from "@/shared/services/logScopeService";
import { convertLogsRequest } from "@/lib/otel/logs";
import { checkOrigin, parseJsonBody } from "@/lib/otel/ingest";
import type { ExportLogsServiceRequest } from "@/lib/otel/types";
import { config } from "@/shared/config";

export const dynamic = "force-dynamic";

/**
 * POST /v1/logs — приём OTLP-логов (OTLP/HTTP JSON).
 *
 * Публичный эндпоинт. Без session_id. Защита: Origin/Referer из ALLOWED_ORIGINS.
 * Тело: ExportLogsServiceRequest (protobuf-JSON по спецификации OTEL).
 */
export async function POST(request: NextRequest) {
  // 1. Проверка Origin.
  const originError = checkOrigin(request);
  if (originError) return originError;

  // 2. Чтение и парсинг тела.
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  // 3. Конвертация OTLP → записи OTEL-модели.
  const entries = convertLogsRequest(body.data as ExportLogsServiceRequest);
  if (entries.length === 0) {
    return NextResponse.json({ error: "no log records" }, { status: 400 });
  }

  if (entries.length > config.openTelemetry.maxLogsPerBatch) {
    return NextResponse.json(
      { error: "too many log records" },
      { status: 413 },
    );
  }

  // 4. Batch insert через сервис логов.
  try {
    await logsService.createMany(
      entries.map((e) => ({
        level: e.level,
        severityNumber: e.severityNumber,
        message: e.message,
        additionals: e.additionals as object | undefined,
        traceId: e.traceId,
        spanId: e.spanId,
        createdAt: e.createdAt ?? undefined,
      })),
    );
  } catch (err) {
    console.error("Failed to insert OTLP logs:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  // OTLP-контракт: 200 OK при успешном приёме.
  return NextResponse.json({}, { status: 200 });
}
