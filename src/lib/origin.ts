/**
 * Проверка Origin/Referer против allowlist ALLOWED_ORIGINS.
 *
 * Приём логов (POST /api/logs) принимается только с разрешённых hosts.
 * Origin — предпочтительный заголовок, Referer — fallback.
 */

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Нормализует origin: убирает завершающий слэш, приводит к нижнему регистру
 * для сравнения host.
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Извлекает origin из заголовка Referer (URL вида https://host/path).
 */
function originFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Проверяет, разрешён ли запрос по заголовкам Origin/Referer.
 * Возвращает true, если origin входит в ALLOWED_ORIGINS.
 */
export function isOriginAllowed(
  originHeader: string | null,
  refererHeader: string | null
): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    // Если allowlist пуст — не принимаем ничего (fail-closed).
    return false;
  }

  const candidates: string[] = [];

  if (originHeader) {
    candidates.push(originHeader);
  }

  if (refererHeader) {
    const fromReferer = originFromReferer(refererHeader);
    if (fromReferer) {
      candidates.push(fromReferer);
    }
  }

  if (candidates.length === 0) {
    // Нет ни Origin, ни валидного Referer — отклоняем.
    return false;
  }

  const allowedSet = new Set(allowed.map(normalizeOrigin));

  return candidates.some((c) => allowedSet.has(normalizeOrigin(c)));
}