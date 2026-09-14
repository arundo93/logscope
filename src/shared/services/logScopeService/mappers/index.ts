/**
 * Мапперы: Prisma-модели → типы сервиса LogScope.
 *
 * Эти функции преобразуют записи из БД в UI-типы. Сервис использует их,
 * чтобы наружу (в UI) отдавать только сериализуемые данные.
 */

import type { LogEntry, Trace, Span } from "@prisma/client";
import type {
  LogItem,
  LogLevel,
  TraceItem,
  WaterfallSpan,
  TraceDetail,
} from "../types";

/** Маппит уровень лога из строки БД в типизированный LogLevel. */
export function toLogLevel(level: string): LogLevel {
  if (level === "warn" || level === "error") return level;
  return "info";
}

/** LogEntry → LogItem. */
export function toLogItem(entry: LogEntry): LogItem {
  return {
    id: entry.id.toString(),
    level: toLogLevel(entry.level),
    message: entry.message,
    additionals: entry.additionals as Record<string, unknown> | null,
    traceId: entry.traceId,
    spanId: entry.spanId,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Trace → TraceItem. */
export function toTraceItem(trace: Trace): TraceItem {
  return {
    traceId: trace.traceId,
    name: trace.name,
    spanCount: trace.spanCount,
    statusCode: trace.statusCode,
    startTime: trace.startTime.toISOString(),
    endTime: trace.endTime.toISOString(),
    durationMs: trace.durationMs,
  };
}

/** Span → WaterfallSpan. */
export function toWaterfallSpan(span: Span): WaterfallSpan {
  return {
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: span.kind,
    statusCode: span.statusCode,
    statusMessage: span.statusMessage,
    startTime: span.startTime.toISOString(),
    endTime: span.endTime.toISOString(),
    durationMs: span.durationMs,
    attributes: span.attributes as Record<string, unknown> | null,
    events: span.events as unknown[] | null,
  };
}

/** Trace + Span[] → TraceDetail. */
export function toTraceDetail(trace: Trace, spans: Span[]): TraceDetail {
  return {
    trace: {
      traceId: trace.traceId,
      name: trace.name,
      spanCount: trace.spanCount,
      statusCode: trace.statusCode,
      startTime: trace.startTime.toISOString(),
      endTime: trace.endTime.toISOString(),
      durationMs: trace.durationMs,
      attributes: trace.attributes as Record<string, unknown> | null,
    },
    spans: spans.map(toWaterfallSpan),
  };
}
