/**
 * Конвертер OTLP трейсов: ExportTraceServiceRequest → { trace, spans }.
 *
 * Проходит по resourceSpans → scopeSpans → spans, извлекает:
 *  - TraceId/SpanId/ParentSpanId (base64 → hex);
 *  - Name, Kind, Status, StartTimeUnixNano, EndTimeUnixNano → durationMs;
 *  - Attributes → attributes (флаттенить, редиакт);
 *  - Events → events;
 *  - агрегат Trace (по trace_id): имя корневого спана, spanCount, startTime,
 *    endTime, durationMs, statusCode.
 */

import { attributesToObject } from "./attributes";
import { base64ToHex } from "./ids";
import type {
  ExportTraceServiceRequest,
  OtlpSpan,
  OtlpSpanEvent,
} from "./types";

export type OtelSpanInput = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: number;
  statusCode: number | null;
  statusMessage: string | null;
  startTime: Date;
  endTime: Date;
  durationMs: number | null;
  attributes: Record<string, unknown> | null;
  events: unknown[] | null;
};

export type OtelTraceInput = {
  traceId: string;
  name: string;
  spanCount: number;
  statusCode: number | null;
  startTime: Date;
  endTime: Date;
  durationMs: number | null;
  attributes: Record<string, unknown> | null;
};

export type ConvertedTrace = {
  trace: OtelTraceInput;
  spans: OtelSpanInput[];
};

/** TimeUnixNano (string, наносекунды) → Date. */
function timeUnixNanoToDate(timeUnixNano: string | undefined): Date | null {
  if (!timeUnixNano) return null;
  const nanos = Number(timeUnixNano);
  if (!Number.isFinite(nanos) || nanos <= 0) return null;
  return new Date(nanos / 1_000_000);
}

/** Конвертирует SpanEvent → plain объект. */
function convertEvent(event: OtlpSpanEvent): Record<string, unknown> {
  return {
    name: event.name ?? "",
    timeUnixNano: event.timeUnixNano ?? null,
    attributes: attributesToObject(event.attributes),
  };
}

/**
 * Конвертирует один OtlpSpan в OtelSpanInput. Возвращает null, если у спана
 * нет валидных traceId/spanId.
 */
export function convertSpan(span: OtlpSpan): OtelSpanInput | null {
  const traceId = base64ToHex(span.traceId);
  const spanId = base64ToHex(span.spanId);
  if (!traceId || !spanId) return null;

  const parentSpanId = base64ToHex(span.parentSpanId);
  const startTime = timeUnixNanoToDate(span.startTimeUnixNano);
  const endTime = timeUnixNanoToDate(span.endTimeUnixNano);

  // Если нет времени — используем текущее (fallback), чтобы не ломать запись.
  const start = startTime ?? new Date();
  const end = endTime ?? start;

  const durationMs =
    end.getTime() >= start.getTime() ? end.getTime() - start.getTime() : null;

  const statusCode = span.status?.code ?? null;
  const statusMessage = span.status?.message ?? null;

  const attributes = attributesToObject(span.attributes);
  const events = (span.events ?? []).map(convertEvent);

  return {
    traceId,
    spanId,
    parentSpanId,
    name: span.name ?? "",
    kind: span.kind ?? 1,
    statusCode,
    statusMessage,
    startTime: start,
    endTime: end,
    durationMs,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    events: events.length > 0 ? events : null,
  };
}

/**
 * Конвертирует ExportTraceServiceRequest → ConvertedTrace.
 * Группирует спаны по trace_id. Если в запросе несколько trace_id — берём
 * первый (агрегат строится по нему), остальные спаны отбрасываем.
 */
export function convertTracesRequest(
  request: ExportTraceServiceRequest,
): ConvertedTrace | null {
  const spans: OtelSpanInput[] = [];

  for (const resourceSpans of request.resourceSpans ?? []) {
    for (const scopeSpans of resourceSpans.scopeSpans ?? []) {
      for (const span of scopeSpans.spans ?? []) {
        const converted = convertSpan(span);
        if (converted) spans.push(converted);
      }
    }
  }

  if (spans.length === 0) return null;

  // Группируем по trace_id, берём первый.
  const firstTraceId = spans[0].traceId;
  const traceSpans = spans.filter((s) => s.traceId === firstTraceId);

  // Корневой спан — без parentSpanId (или parent не входит в этот трейс).
  const root =
    traceSpans.find((s) => !s.parentSpanId) ??
    traceSpans.find(
      (s) => !traceSpans.some((o) => o.spanId === s.parentSpanId),
    ) ??
    traceSpans[0];

  const startTime = traceSpans.reduce(
    (min, s) => (s.startTime < min ? s.startTime : min),
    traceSpans[0].startTime,
  );
  const endTime = traceSpans.reduce(
    (max, s) => (s.endTime > max ? s.endTime : max),
    traceSpans[0].endTime,
  );

  const durationMs =
    endTime.getTime() >= startTime.getTime()
      ? endTime.getTime() - startTime.getTime()
      : null;

  // Статус трейса — статус корневого спана (или первый не-UNSET).
  const statusCode =
    root.statusCode && root.statusCode !== 0
      ? root.statusCode
      : (traceSpans.find((s) => s.statusCode && s.statusCode !== 0)
          ?.statusCode ?? null);

  const trace: OtelTraceInput = {
    traceId: firstTraceId,
    name: root.name || "trace",
    spanCount: traceSpans.length,
    statusCode,
    startTime,
    endTime,
    durationMs,
    attributes: root.attributes,
  };

  return { trace, spans: traceSpans };
}
