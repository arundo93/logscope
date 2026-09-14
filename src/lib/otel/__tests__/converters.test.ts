/**
 * Юнит-тесты OTLP-конвертеров.
 *
 * Запуск: `npm test` (требует Node 20+ и tsx).
 * Примеры OTLP JSON взяты из спецификации OpenTelemetry (protobuf-JSON).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { base64ToHex, hexToBase64, isValidTraceIdHex } from "../ids";
import { convertLogsRequest } from "../logs";
import { resolveLevel, severityNumberToLevel } from "../severity";
import { convertTracesRequest } from "../traces";

// --- ids ---

test("base64ToHex конвертирует base64 в hex", () => {
	// "0102030405060708" (8 байт) в base64
	const b64 = Buffer.from("0102030405060708", "hex").toString("base64");
	assert.equal(base64ToHex(b64), "0102030405060708");
});

test("base64ToHex возвращает null для пустого/невалидного входа", () => {
	assert.equal(base64ToHex(null), null);
	assert.equal(base64ToHex(""), null);
	assert.equal(base64ToHex(undefined), null);
});

test("hexToBase64 обратная конвертация", () => {
	const hex = "0102030405060708";
	assert.equal(base64ToHex(hexToBase64(hex)), hex);
});

test("isValidTraceIdHex проверяет длину 32 hex", () => {
	assert.equal(isValidTraceIdHex("a".repeat(32)), true);
	assert.equal(isValidTraceIdHex("a".repeat(31)), false);
	assert.equal(isValidTraceIdHex("z".repeat(32)), false);
});

// --- severity ---

test("severityNumberToLevel маппит диапазоны", () => {
	assert.equal(severityNumberToLevel(9), "info");
	assert.equal(severityNumberToLevel(13), "warn");
	assert.equal(severityNumberToLevel(17), "error");
	assert.equal(severityNumberToLevel(24), "error");
	assert.equal(severityNumberToLevel(null), "info");
});

test("resolveLevel отдаёт приоритет SeverityText", () => {
	assert.equal(resolveLevel("ERROR", 9), "error");
	assert.equal(resolveLevel("WARN", 9), "warn");
	assert.equal(resolveLevel("INFO", 17), "info");
	assert.equal(resolveLevel(null, 17), "error");
});

// --- logs ---

test("convertLogsRequest конвертирует OTLP-логи", () => {
	const request = {
		resourceLogs: [
			{
				resource: {
					attributes: [{ key: "service.name", value: { stringValue: "app" } }],
				},
				scopeLogs: [
					{
						logRecords: [
							{
								timeUnixNano: "1720000000000000000",
								severityNumber: 17,
								severityText: "ERROR",
								body: { stringValue: "boom" },
								attributes: [
									{ key: "category", value: { stringValue: "api" } },
									{ key: "status", value: { intValue: "500" } },
									{ key: "token", value: { stringValue: "secret123" } },
								],
								traceId: Buffer.from("a".repeat(32), "hex").toString("base64"),
								spanId: Buffer.from("b".repeat(16), "hex").toString("base64"),
							},
						],
					},
				],
			},
		],
	};

	const entries = convertLogsRequest(request as never);
	assert.equal(entries.length, 1);
	const e = entries[0];
	assert.equal(e.level, "error");
	assert.equal(e.severityNumber, 17);
	assert.equal(e.message, "boom");
	assert.equal(e.additionals?.category, "api");
	assert.equal(e.additionals?.status, 500);
	// Секретный ключ редиактится.
	assert.equal(e.additionals?.token, "[REDACTED]");
	assert.equal(e.traceId, "a".repeat(32));
	assert.equal(e.spanId, "b".repeat(16));
	assert.ok(e.createdAt instanceof Date);
});

test("convertLogsRequest пропускает записи без message", () => {
	const request = {
		resourceLogs: [
			{
				scopeLogs: [
					{
						logRecords: [
							{ body: { stringValue: "" } },
							{ body: { stringValue: "ok" } },
						],
					},
				],
			},
		],
	};
	const entries = convertLogsRequest(request as never);
	assert.equal(entries.length, 1);
	assert.equal(entries[0].message, "ok");
});

// --- traces ---

test("convertTracesRequest строит агрегат и спаны", () => {
	const traceId = "a".repeat(32);
	const spanIdRoot = "b".repeat(16);
	const spanIdChild = "c".repeat(16);

	const request = {
		resourceSpans: [
			{
				scopeSpans: [
					{
						spans: [
							{
								traceId: Buffer.from(traceId, "hex").toString("base64"),
								spanId: Buffer.from(spanIdRoot, "hex").toString("base64"),
								name: "root",
								kind: 2,
								startTimeUnixNano: "1720000000000000000",
								endTimeUnixNano: "1720000000100000000",
								status: { code: 1, message: "ok" },
							},
							{
								traceId: Buffer.from(traceId, "hex").toString("base64"),
								spanId: Buffer.from(spanIdChild, "hex").toString("base64"),
								parentSpanId: Buffer.from(spanIdRoot, "hex").toString("base64"),
								name: "child",
								kind: 3,
								startTimeUnixNano: "1720000000000000000",
								endTimeUnixNano: "1720000000050000000",
							},
						],
					},
				],
			},
		],
	};

	const converted = convertTracesRequest(request as never);
	assert.ok(converted);
	assert.equal(converted.trace.traceId, "a".repeat(32));
	assert.equal(converted.trace.name, "root");
	assert.equal(converted.trace.spanCount, 2);
	assert.equal(converted.trace.statusCode, 1);
	assert.equal(converted.trace.durationMs, 100);
	assert.equal(converted.spans.length, 2);
	assert.equal(converted.spans[1].parentSpanId, "b".repeat(16));
});

test("convertTracesRequest возвращает null без спанов", () => {
	assert.equal(convertTracesRequest({ resourceSpans: [] } as never), null);
});
