"use client";

import { useState } from "react";
import { loginAction } from "@/shared/services/logScopeService/actions";

/**
 * Форма входа по ключу доступа.
 * Вызывает serverAction loginAction (см. src/services/logscope/action.ts).
 */
export default function LoginForm() {
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginAction(accessKey);
      if (result.error) {
        setError(result.error);
      }
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="access-key">Ключ доступа</label>
        <input
          id="access-key"
          className="input"
          type="password"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="ACCESS_KEY"
          autoFocus
          required
        />
      </div>

      {error && <div className="error-text">{error}</div>}

      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </button>
    </form>
  );
}
