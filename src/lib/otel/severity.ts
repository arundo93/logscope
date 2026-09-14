/**
 * Маппинг OTEL SeverityNumber ↔ уровень лога (info|warn|error).
 *
 * OTEL SeverityNumber — целое число от 1 до 24 (TRACE=1..4, DEBUG=5..8,
 * INFO=9..12, WARN=13..16, ERROR=17..20, FATAL=21..24). Мы сводим к трём
 * уровням, которые использует UI: info|warn|error.
 */

export const LOG_LEVELS = ["info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * SeverityNumber → уровень. Если число не распознано — fallback на "info".
 */
export function severityNumberToLevel(
	severityNumber: number | null | undefined,
): LogLevel {
	if (severityNumber == null) return "info";
	if (severityNumber >= 13 && severityNumber <= 16) return "warn";
	if (severityNumber >= 17) return "error";
	return "info";
}

/**
 * SeverityText → уровень. SeverityText — строковое представление уровня
 * (например "INFO", "WARN", "ERROR", "FATAL"). Используется как приоритетный
 * источник, если он задан.
 */
export function severityTextToLevel(
	severityText: string | null | undefined,
): LogLevel | null {
	if (!severityText) return null;
	const t = severityText.trim().toLowerCase();
	if (t.startsWith("error") || t.startsWith("fatal")) return "error";
	if (t.startsWith("warn")) return "warn";
	if (t.startsWith("info") || t.startsWith("debug") || t.startsWith("trace")) {
		return "info";
	}
	return null;
}

/**
 * Итоговый уровень: SeverityText приоритетнее, иначе SeverityNumber.
 */
export function resolveLevel(
	severityText: string | null | undefined,
	severityNumber: number | null | undefined,
): LogLevel {
	return (
		severityTextToLevel(severityText) ?? severityNumberToLevel(severityNumber)
	);
}
