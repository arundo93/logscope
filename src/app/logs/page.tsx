import { redirect } from "next/navigation";
import { logScopeService } from "@/shared/services/logScopeService";
import LogsView from "./_ui/LogsView";

export const dynamic = "force-dynamic";

/**
 * Страница просмотра логов и трейсов.
 *
 * Серверный компонент: проверяет авторизацию через экземпляр сервиса
 * (logScopeService) и рендерит клиентский LogsView, который для интерактивных
 * операций использует serverActions (src/services/logscope/action.ts).
 */
export default async function LogsPage() {
  const authorized = await logScopeService.isAuthorized();
  if (!authorized) {
    redirect("/login");
  }

  return <LogsView />;
}
