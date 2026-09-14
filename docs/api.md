# API Logscope

Базовый URL: `http://localhost:3000` (в dev).

Logscope — OTEL-бэкенд: принимает логи и трейсы по **OTLP/HTTP (JSON)** и
предоставляет веб-интерфейс для просмотра.

## Приём (OTLP/HTTP)

Публичные эндпоинты. **Без `session_id`.** Защита: заголовок `Origin` (или
`Referer`) должен входить в `ALLOWED_ORIGINS` (env). Иначе `403`.

Формат тела — **protobuf-JSON** по спецификации OpenTelemetry
(`ExportLogsServiceRequest` / `ExportTraceServiceRequest`).

Ограничения:

- размер тела ≤ **1 МБ**;
- максимум **200** записей/спанов на батч.

Санитизация на сервере: редиакт ключей `secret/token/authorization/jwt/password`,
обрезка строк, лимит глубины и размера `attributes`.

### POST /v1/logs — приём логов

Тело: `ExportLogsServiceRequest`.

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "app" } }
        ]
      },
      "scopeLogs": [
        {
          "logRecords": [
            {
              "timeUnixNano": "1720000000000000000",
              "severityNumber": 17,
              "severityText": "ERROR",
              "body": { "stringValue": "boom" },
              "attributes": [
                { "key": "category", "value": { "stringValue": "api" } }
              ],
              "traceId": "base64",
              "spanId": "base64"
            }
          ]
        }
      ]
    }
  ]
}
```

Ответы:

- `200 OK` — логи приняты (OTLP-контракт).
- `400 Bad Request` — невалидное тело / нет записей.
- `403 Forbidden` — origin не в allowlist.
- `413 Payload Too Large` — тело больше 1 МБ / больше 200 записей.
- `500 Internal Server Error` — ошибка БД.

### POST /v1/traces — приём трейсов

Тело: `ExportTraceServiceRequest`.

```json
{
  "resourceSpans": [
    {
      "scopeSpans": [
        {
          "spans": [
            {
              "traceId": "base64",
              "spanId": "base64",
              "parentSpanId": "base64",
              "name": "root",
              "kind": 2,
              "startTimeUnixNano": "1720000000000000000",
              "endTimeUnixNano": "1720000000100000000",
              "status": { "code": 1, "message": "ok" }
            }
          ]
        }
      ]
    }
  ]
}
```

При приёме выполняется upsert агрегата в таблицу `traces` (по `trace_id`) и
batch insert спанов в `spans`.

Ответы: `200 OK` или ошибка (как у `/v1/logs`).

## Авторизация и просмотр

Просмотр реализован на **серверном рендеринге** (Next.js App Router) и
**serverActions** — внутреннего REST API просмотра нет.

- Страницы `/login` и `/logs` — серверные компоненты. Они используют
  синглтон-экземпляр сервиса (`src/shared/services/logScopeService/index.ts`), который
  проверяет авторизацию (`isAuthorized()`) и читает данные напрямую из БД.
- Интерактивные операции (вход, выход, фильтрация, пагинация логов и трейсов)
  выполняются через **serverActions** (`src/shared/services/logScopeService/actions.ts`):
  `loginAction`, `logoutAction`, `getLogsAction`, `getTracesAction`,
  `getTraceAction`, `getSessionsAction`.
- Авторизованный пользователь видит **все** логи и трейсы (изоляции нет).

### Вход

`POST /login` (форма) → `loginAction(accessKey)`. При верном ключе создаётся
сессия и ставится cookie `session_id` (`HttpOnly`, `SameSite=Lax`, `Secure` в
production). При неверном ключе возвращается ошибка.

### Выход

`logoutAction()` — удаляет сессию из БД и сбрасывает cookie.

## Защищённые маршруты

Middleware (`src/middleware.ts`) защищает:

- `/logs` (страница) — без cookie редирект на `/login`.

OTLP-эндпоинты `/v1/logs`, `/v1/traces` — **публичные** (без cookie), защищены
только проверкой Origin.

Полная валидация сессии (существование + не истекла) выполняется в серверном
коде через `lib/session.ts` и сервис (`logScopeService.isAuthorized()`).
