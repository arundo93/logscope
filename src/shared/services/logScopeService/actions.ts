"use server";

/**
 * Server Actions сервиса LogScope.
 *
 * Экспортируют методы экземпляра сервиса (logScopeService) как serverActions.
 * Используются в клиентских компонентах (_ui) для интерактивных операций:
 * вход, выход, фильтрация/пагинация логов и трейсов.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logScopeService } from "./index";
import type { LogsQuery, TracesQuery } from "./types";

/** Вход по ключу доступа. */
export async function loginAction(
	accessKey: string,
): Promise<{ error?: string }> {
	const result = await logScopeService.login(accessKey);
	if (!result.ok) {
		return { error: result.error };
	}
	revalidatePath("/logs");
	redirect("/logs");
}

/** Выход. */
export async function logoutAction(): Promise<void> {
	await logScopeService.logout();
	revalidatePath("/logs");
	redirect("/login");
}

/** Список логов (для клиентских компонентов). */
export async function getLogsAction(query: LogsQuery) {
	return logScopeService.getLogs(query);
}

/** Список трейсов (для клиентских компонентов). */
export async function getTracesAction(query: TracesQuery) {
	return logScopeService.getTraces(query);
}

/** Полный трейс (для клиентских компонентов). */
export async function getTraceAction(traceId: string) {
	return logScopeService.getTrace(traceId);
}
