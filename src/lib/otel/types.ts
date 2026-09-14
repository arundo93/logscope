/**
 * Типы OTLP protobuf-JSON (OpenTelemetry Protocol).
 *
 * Отражают структуру ExportLogsServiceRequest и ExportTraceServiceRequest
 * в JSON-представлении (protobuf-JSON). Поля, которые не используются
 * конвертерами, помечены как optional.
 */

// --- Общие примитивы ---

/** AnyValue — произвольное значение атрибута (oneof value). */
export type OtlpAnyValue =
	| { stringValue?: string }
	| { boolValue?: boolean }
	| { intValue?: string }
	| { doubleValue?: number }
	| { arrayValue?: { values?: OtlpAnyValue[] } }
	| { kvlistValue?: { values?: OtlpKeyValue[] } }
	| { bytesValue?: string };

export type OtlpKeyValue = {
	key?: string;
	value?: OtlpAnyValue;
};

export type OtlpAttributes = OtlpKeyValue[];

// --- Логи ---

export type OtlpLogRecord = {
	timeUnixNano?: string;
	observedTimeUnixNano?: string;
	severityNumber?: number;
	severityText?: string;
	body?: OtlpAnyValue;
	attributes?: OtlpAttributes;
	droppedAttributesCount?: number;
	flags?: number;
	traceId?: string; // base64
	spanId?: string; // base64
};

export type OtlpScopeLogs = {
	scope?: unknown;
	logRecords?: OtlpLogRecord[];
};

export type OtlpResourceLogs = {
	resource?: { attributes?: OtlpAttributes };
	scopeLogs?: OtlpScopeLogs[];
	schemaUrl?: string;
};

export type ExportLogsServiceRequest = {
	resourceLogs?: OtlpResourceLogs[];
};

// --- Трейсы ---

export type OtlpSpanEvent = {
	timeUnixNano?: string;
	name?: string;
	attributes?: OtlpAttributes;
	droppedAttributesCount?: number;
};

export type OtlpSpan = {
	traceId?: string; // base64
	spanId?: string; // base64
	traceState?: string;
	parentSpanId?: string; // base64
	flags?: number;
	name?: string;
	kind?: number; // SpanKind
	startTimeUnixNano?: string;
	endTimeUnixNano?: string;
	attributes?: OtlpAttributes;
	droppedAttributesCount?: number;
	events?: OtlpSpanEvent[];
	droppedEventsCount?: number;
	status?: { code?: number; message?: string };
};

export type OtlpScopeSpans = {
	scope?: unknown;
	spans?: OtlpSpan[];
	schemaUrl?: string;
};

export type OtlpResourceSpans = {
	resource?: { attributes?: OtlpAttributes };
	scopeSpans?: OtlpScopeSpans[];
	schemaUrl?: string;
};

export type ExportTraceServiceRequest = {
	resourceSpans?: OtlpResourceSpans[];
};

// --- Константы ---

/** OTEL SpanKind: INTERNAL=1, SERVER=2, CLIENT=3, PRODUCER=4, CONSUMER=5. */
export const SPAN_KIND = {
	UNSPECIFIED: 0,
	INTERNAL: 1,
	SERVER: 2,
	CLIENT: 3,
	PRODUCER: 4,
	CONSUMER: 5,
} as const;

/** OTEL StatusCode: UNSET=0, OK=1, ERROR=2. */
export const STATUS_CODE = {
	UNSET: 0,
	OK: 1,
	ERROR: 2,
} as const;
