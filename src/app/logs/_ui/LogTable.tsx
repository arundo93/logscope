"use client";

import { useState } from "react";
import type { LogItem } from "@/shared/services/logScopeService/types";

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

function AdditionalsJson({ value }: { value: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(value, null, 2);

  return (
    <div className="details">
      <summary onClick={() => setOpen((o) => !o)}>
        {open ? "Скрыть" : "Показать"} additionals
      </summary>
      {open && <pre className="log-additionals">{json}</pre>}
    </div>
  );
}

export default function LogTable({ items }: { items: LogItem[] }) {
  if (items.length === 0) {
    return <div className="loading">Логов нет</div>;
  }

  return (
    <div className="panel" style={{ overflowX: "auto" }}>
      <table className="log-table">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Уровень</th>
            <th style={{ width: 150 }}>Время</th>
            <th>Сообщение</th>
            <th style={{ width: 200 }}>Additionals</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className={`badge badge-${item.level}`}>
                  {item.level}
                </span>
              </td>
              <td className="log-time">{formatTime(item.createdAt)}</td>
              <td className="log-message">{item.message}</td>
              <td>
                {item.additionals &&
                Object.keys(item.additionals).length > 0 ? (
                  <AdditionalsJson value={item.additionals} />
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
