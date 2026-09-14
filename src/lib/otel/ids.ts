/**
 * Конвертация OTEL TraceId/SpanId между base64 (protobuf-JSON) и hex.
 *
 * В OTLP protobuf-JSON поля trace_id/span_id приходят как base64-строки
 * (bytes). В БД и UI мы храним их в hex-представлении (32 hex для trace,
 * 16 hex для span).
 */

/**
 * base64 → hex. Принимает строку base64 (стандартный или URL-safe алфавит).
 * Возвращает hex-строку в нижнем регистре или null, если вход невалиден.
 */
export function base64ToHex(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const binary = Buffer.from(normalized, "base64");
    if (binary.length === 0) return null;
    return binary.toString("hex");
  } catch {
    return null;
  }
}

/**
 * hex → base64. Обратная конвертация (для тестов и отладки).
 */
export function hexToBase64(hex: string | null | undefined): string | null {
  if (!hex) return null;
  try {
    const normalized = hex.replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]+$/.test(normalized)) return null;
    return Buffer.from(normalized, "hex").toString("base64");
  } catch {
    return null;
  }
}

/**
 * Валидирует hex-представление trace_id (ровно 32 hex-символа).
 */
export function isValidTraceIdHex(hex: string | null | undefined): boolean {
  return !!hex && /^[0-9a-f]{32}$/i.test(hex);
}

/**
 * Валидирует hex-представление span_id (ровно 16 hex-символов).
 */
export function isValidSpanIdHex(hex: string | null | undefined): boolean {
  return !!hex && /^[0-9a-f]{16}$/i.test(hex);
}
