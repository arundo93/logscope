/**
 * Серверная санитизация атрибутов (OTEL Attributes / additionals).
 *
 * Клиент недоверенный — может прислать секреты в attributes или слишком
 * длинные строки. Здесь мы:
 *  - редиактим ключи secret/token/authorization/jwt/password (рекурсивно);
 *  - обрезаем слишком длинные строки;
 *  - ограничиваем глубину вложенности.
 */

import { config } from "@/shared/config";

const SECRET_KEY_PATTERN =
  /(secret|token|authorization|auth|jwt|password|passwd|api[_-]?key|access[_-]?key|credential)/i;

const REDACTED = "[REDACTED]";

const MAX_STRING_LENGTH = 4096;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return value.slice(0, MAX_STRING_LENGTH) + "…[truncated]";
}

/**
 * Рекурсивно санитизирует произвольное значение:
 *  - строки обрезаются;
 *  - значения под секретными ключами редиактятся;
 *  - глубина ограничивается.
 */
export function sanitizeValue(value: unknown, depth = 0, key = ""): unknown {
  if (depth > config.openTelemetry.maxAttributesDepth) {
    return "[depth-limit]";
  }

  if (typeof value === "string") {
    if (isSecretKey(key)) return REDACTED;
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      sanitizeValue(item, depth + 1, `${key}[${i}]`),
    );
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = sanitizeValue(v, depth + 1, k);
    }
    return result;
  }

  // Функции, символы и прочее — не сериализуемо, заменяем строкой.
  return String(value);
}
