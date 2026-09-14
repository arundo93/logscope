/**
 * Экземпляр сервиса LogScope.
 *
 * Создаётся ОДИН раз: инстанцирует сервисы по таблицам (usersService,
 * sessionsService, logsService, tracesService) и передаёт их в конструктор
 * LogScopeService. Используется в серверных компонентах и serverActions.
 */

import { LogsService } from "@/shared/services/logsService";
import { SessionsService } from "@/shared/services/sessionsService";
import { TracesService } from "@/shared/services/tracesService";
import { UsersService } from "@/shared/services/usersService";
import { LogScopeService } from "./service";

// Сервисы по таблицам (могут переиспользоваться другими сервисами).
export const usersService = new UsersService();
export const sessionsService = new SessionsService();
export const logsService = new LogsService();
export const tracesService = new TracesService();

// Оркестратор для UI.
export const logScopeService = new LogScopeService(
	usersService,
	sessionsService,
	logsService,
	tracesService,
);

export type { LogScopeService } from "./service";
export * from "./types";
