/**
 * Конвертер OTLP логов: ExportLogsServiceRequest → записи для таблицы log_entries.
 *
 * Проходит по resourceLogs → scopeLogs → logRecords, извлекает:
 *  - SeverityText/SeverityNumber → level + severityNumber;
 *  - Body (string) → message;
 *  - Attributes → additionals (флаттенить, редиакт секретов);
 *  - TraceId/SpanId (base64 → hex) → traceId/spanId;
 *  - TimeUnixNano → createdAt.
 *
 * Результат напрямую соответствует модели Prisma LogEntry (OTEL-контракт).
 */

import { attributesToObject } from "./attributes";
import { base64ToHex } from "./ids";
import { resolveLevel } from "./severity";
import type { ExportLogsServiceRequest, OtlpLogRecord } from "./types";

/** Запись лога в формате OTEL-модели (маппится на Prisma LogEntry). */
export type OtelLogEntry = {
	level: string;
	severityNumber: number | null;
	message: string;
	additionals: Record<string, unknown> | null;
	traceId: string | null;
	spanId: string | null;
	createdAt: Date | null;
};

const MAX_MESSAGE_LENGTH = 4096;

function truncate(value: string): string {
	if (value.length <= MAX_MESSAGE_LENGTH) return value;
	return `${value.slice(0, MAX_MESSAGE_LENGTH)}…[truncated]`;
}

/**
 * Извлекает строковое значение Body (AnyValue). Поддерживает stringValue,
 * а также примитивы (числа/булевы) — приводим к строке.
 */
function bodyToString(body: OtlpLogRecord["body"]): string {
	if (!body) return "";
	if ("stringValue" in body && body.stringValue !== undefined) {
		return body.stringValue;
	}
	if ("boolValue" in body && body.boolValue !== undefined) {
		return String(body.boolValue);
	}
	if ("intValue" in body && body.intValue !== undefined) {
		return body.intValue;
	}
	if ("doubleValue" in body && body.doubleValue !== undefined) {
		return String(body.doubleValue);
	}
	return "";
}

/**
 * TimeUnixNano (string, наносекунды) → Date. Возвращает null при невалидном
 * значении.
 */
function timeUnixNanoToDate(timeUnixNano: string | undefined): Date | null {
	if (!timeUnixNano) return null;
	const nanos = Number(timeUnixNano);
	if (!Number.isFinite(nanos) || nanos <= 0) return null;
	return new Date(nanos / 1_000_000);
}

/**
 * Конвертирует один LogRecord в запись OTEL-модели.
 */
export function convertLogRecord(record: OtlpLogRecord): OtelLogEntry {
	const level = resolveLevel(record.severityText, record.severityNumber);
	const message = truncate(bodyToString(record.body));
	const additionals = attributesToObject(record.attributes);
	const traceId = base64ToHex(record.traceId);
	const spanId = base64ToHex(record.spanId);
	const createdAt = timeUnixNanoToDate(record.timeUnixNano);

	return {
		level,
		severityNumber: record.severityNumber ?? null,
		message,
		additionals: Object.keys(additionals).length > 0 ? additionals : null,
		traceId,
		spanId,
		createdAt,
	};
}

/**
 * Конвертирует ExportLogsServiceRequest → записи OTEL-модели.
 * Пропускает записи без message (пустой Body).
 */
export function convertLogsRequest(
	request: ExportLogsServiceRequest,
): OtelLogEntry[] {
	const entries: OtelLogEntry[] = [];

	for (const resourceLogs of request.resourceLogs ?? []) {
		for (const scopeLogs of resourceLogs.scopeLogs ?? []) {
			for (const record of scopeLogs.logRecords ?? []) {
				const entry = convertLogRecord(record);
				if (!entry.message) continue;
				entries.push(entry);
			}
		}
	}

	return entries;
}
