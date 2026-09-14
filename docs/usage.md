# Использование

Отправка логов и трейсов по **OTLP/HTTP (JSON)** в `POST /v1/logs` и
`POST /v1/traces` (без `session_id`).

## Отправка логов (пример curl)

```bash
curl -X POST http://localhost:3000/v1/logs \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "resourceLogs": [
      {
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
                ]
              }
            ]
          }
        ]
      }
    ]
  }'
```

Ответ: `200 OK`.

## Отправка трейсов (пример curl)

```bash
curl -X POST http://localhost:3000/v1/traces \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{
    "resourceSpans": [
      {
        "scopeSpans": [
          {
            "spans": [
              {
                "traceId": "base64",
                "spanId": "base64",
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
  }'
```

Ответ: `200 OK`.

## Интеграция с клиентом

Клиент отправляет логи и трейсы по **OTLP/HTTP (JSON)** в `POST /v1/logs` и
`POST /v1/traces` (без `session_id`). Необходимо:

1. Настроить `ALLOWED_ORIGINS` — добавить origin, с которого работает SPA.
2. Отправлять запросы с заголовком `Origin` (браузер делает это автоматически для
   cross-origin запросов).
3. Использовать стандартный OTEL SDK/экспортёр (например,
   `@opentelemetry/exporter-trace-otlp-http` и `@opentelemetry/exporter-logs-otlp-http`)
   с `url: http://<host>:3000/v1/logs` и `.../v1/traces`.
