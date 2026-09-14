import { type NextRequest, NextResponse } from "next/server";
import { checkOrigin, parseJsonBody } from "@/lib/otel/ingest";
import { convertTracesRequest } from "@/lib/otel/traces";
import type { ExportTraceServiceRequest } from "@/lib/otel/types";
import { config } from "@/shared/config";
import { tracesService } from "@/shared/services/logScopeService";

export const dynamic = "force-dynamic";

/**
 * POST /v1/traces — приём OTLP-трейсов (OTLP/HTTP JSON).
 *
 * Публичный эндпоинт. Без session_id. Защита: Origin/Referer из ALLOWED_ORIGINS.
 * Тело: ExportTraceServiceRequest (protobuf-JSON по спецификации OTEL).
 *
 * Запись: upsert агрегата в `traces` (по trace_id) + batch insert спанов в `spans`.
 */
export async function POST(request: NextRequest) {
	// 1. Проверка Origin.
	const originError = checkOrigin(request);
	if (originError) return originError;

	// 2. Чтение и парсинг тела.
	const body = await parseJsonBody(request);
	if (!body.ok) return body.response;

	// 3. Конвертация OTLP → агрегат + спаны.
	const converted = convertTracesRequest(
		body.data as ExportTraceServiceRequest,
	);
	if (!converted) {
		return NextResponse.json({ error: "no spans" }, { status: 400 });
	}

	if (converted.spans.length > config.openTelemetry.maxLogsPerBatch) {
		return NextResponse.json({ error: "too many spans" }, { status: 413 });
	}

	const { trace, spans } = converted;

	// 4. Запись через сервис трейсов: upsert агрегата + batch insert спанов.
	try {
		await tracesService.upsertTraceWithSpans({
			trace: {
				traceId: trace.traceId,
				name: trace.name,
				spanCount: trace.spanCount,
				statusCode: trace.statusCode,
				startTime: trace.startTime,
				endTime: trace.endTime,
				durationMs: trace.durationMs,
				attributes: trace.attributes as object | undefined,
			},
			spans: spans.map((s) => ({
				traceId: s.traceId,
				spanId: s.spanId,
				parentSpanId: s.parentSpanId,
				name: s.name,
				kind: s.kind,
				statusCode: s.statusCode,
				statusMessage: s.statusMessage,
				startTime: s.startTime,
				endTime: s.endTime,
				durationMs: s.durationMs,
				attributes: s.attributes as object | undefined,
				events: s.events as object[] | undefined,
			})),
		});
	} catch (err) {
		console.error("Failed to insert OTLP traces:", err);
		return NextResponse.json({ error: "internal error" }, { status: 500 });
	}

	// OTLP-контракт: 200 OK при успешном приёме.
	return NextResponse.json({}, { status: 200 });
}
