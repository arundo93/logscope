"use client";

import type { TraceItem } from "@/shared/services/logScopeService/types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms.toFixed(0)} мс`;
  return `${(ms / 1000).toFixed(2)} с`;
}

function statusLabel(code: number | null): string {
  if (code === 2) return "error";
  if (code === 1) return "ok";
  return "—";
}

export default function TraceList({
  items,
  onSelect,
}: {
  items: TraceItem[];
  onSelect: (traceId: string) => void;
}) {
  if (items.length === 0) {
    return <div className="loading">Трейсов нет</div>;
  }

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <table className="log-table">
        <thead>
          <tr>
            <th style={{ width: 200 }}>Trace ID</th>
            <th>Имя</th>
            <th style={{ width: 80 }}>Спаны</th>
            <th style={{ width: 90 }}>Статус</th>
            <th style={{ width: 150 }}>Время</th>
            <th style={{ width: 100 }}>Длительность</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr
              key={t.traceId}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(t.traceId)}
            >
              <td className="log-time">{t.traceId}</td>
              <td className="log-message">{t.name}</td>
              <td>{t.spanCount}</td>
              <td>
                <span
                  className={`badge ${
                    t.statusCode === 2 ? "badge-error" : "badge-info"
                  }`}
                >
                  {statusLabel(t.statusCode)}
                </span>
              </td>
              <td className="log-time">{formatTime(t.startTime)}</td>
              <td className="log-time">{formatDuration(t.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
