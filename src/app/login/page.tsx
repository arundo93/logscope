import { redirect } from "next/navigation";
import { logScopeService } from "@/shared/services/logScopeService";
import LoginForm from "./_ui/LoginForm";

export const dynamic = "force-dynamic";

/**
 * Страница входа по ключу доступа.
 * Если уже авторизован — редирект на /logs.
 */
export default async function LoginPage() {
  const authorized = await logScopeService.isAuthorized();
  if (authorized) {
    redirect("/logs");
  }

  return (
    <div className="login-wrap">
      <div className="panel login-card">
        <h1>Logscope</h1>
        <p className="muted">Введите ключ доступа для просмотра логов</p>
        <LoginForm />
      </div>
    </div>
  );
}
