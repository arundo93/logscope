/**
 * Конвертация OTEL Attributes (KeyValue[]) в plain JS-объект.
 *
 * - AnyValue → примитив/массив/объект;
 * - вложенные kvlistValue флаттенятся в объект;
 * - результат прогоняется через sanitizeValue (редиакт секретов, обрезка строк).
 */

import { sanitizeValue } from "@/lib/sanitize";
import type { OtlpAnyValue, OtlpAttributes } from "./types";

/**
 * AnyValue → plain JS-значение.
 */
export function anyValueToJs(value: OtlpAnyValue | undefined): unknown {
	if (!value) return null;

	if ("stringValue" in value && value.stringValue !== undefined) {
		return value.stringValue;
	}
	if ("boolValue" in value && value.boolValue !== undefined) {
		return value.boolValue;
	}
	if ("intValue" in value && value.intValue !== undefined) {
		const n = Number(value.intValue);
		return Number.isFinite(n) ? n : value.intValue;
	}
	if ("doubleValue" in value && value.doubleValue !== undefined) {
		return value.doubleValue;
	}
	if ("bytesValue" in value && value.bytesValue !== undefined) {
		return value.bytesValue;
	}
	if ("arrayValue" in value && value.arrayValue?.values) {
		return value.arrayValue.values.map((v) => anyValueToJs(v));
	}
	if ("kvlistValue" in value && value.kvlistValue?.values) {
		return attributesToObject(value.kvlistValue.values);
	}

	return null;
}

/**
 * Attributes (KeyValue[]) → plain объект. Дублирующиеся ключи: последний
 * выигрывает. Результат санитизируется.
 */
export function attributesToObject(
	attributes: OtlpAttributes | undefined,
): Record<string, unknown> {
	const raw: Record<string, unknown> = {};
	if (!attributes) return raw;

	for (const kv of attributes) {
		if (!kv.key) continue;
		raw[kv.key] = anyValueToJs(kv.value);
	}

	return sanitizeValue(raw, 0, "") as Record<string, unknown>;
}

/**
 * Извлекает строковое значение атрибута по ключу (для resource-атрибутов
 * вроде service.name). Возвращает null, если атрибута нет.
 */
export function getStringAttribute(
	attributes: OtlpAttributes | undefined,
	key: string,
): string | null {
	if (!attributes) return null;
	for (const kv of attributes) {
		if (kv.key === key && kv.value && "stringValue" in kv.value) {
			return kv.value.stringValue ?? null;
		}
	}
	return null;
}
