/**
 * Типы сервиса LogScope.
 *
 * Именно эти типы попадают в UI (серверные компоненты и _ui). Они не зависят
 * от Prisma-моделей напрямую — маппинг из БД в эти типы выполняют мапперы
 * (src/shared/services/logScopeService/mappers).
 */

/** Уровень лога. */
export type LogLevel = "info" | "warn" | "error";

/** Запись лога для UI. */
export type LogItem = {
	id: string;
	level: LogLevel;
	message: string;
	additionals?: Record<string, unknown> | null;
	traceId?: string | null;
	spanId?: string | null;
	createdAt: string;
};

/** Запись трейса (список) для UI. */
export type TraceItem = {
	traceId: string;
	name: string;
	spanCount: number;
	statusCode: number | null;
	startTime: string;
	endTime: string;
	durationMs: number | null;
};

/** Спан трейса для waterfall-представления. */
export type WaterfallSpan = {
	spanId: string;
	parentSpanId: string | null;
	name: string;
	kind: number;
	statusCode: number | null;
	statusMessage: string | null;
	startTime: string;
	endTime: string;
	durationMs: number | null;
	attributes: Record<string, unknown> | null;
	events: unknown[] | null;
};

/** Полный трейс (агрегат + спаны) для UI. */
export type TraceDetail = {
	trace: {
		traceId: string;
		name: string;
		spanCount: number;
		statusCode: number | null;
		startTime: string;
		endTime: string;
		durationMs: number | null;
		attributes: Record<string, unknown> | null;
	};
	spans: WaterfallSpan[];
};

/** Пагинированный ответ. */
export type Paginated<T> = {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
};

/** Фильтр по атрибуту лога (additionals): ключ = значение. */
export type AttributeFilter = {
	key: string;
	value: string;
};

/** Параметры запроса логов. */
export type LogsQuery = {
	level?: LogLevel;
	q?: string;
	traceId?: string;
	/** Фильтры по атрибутам логов (additionals). Применяются как AND. */
	attributes?: AttributeFilter[];
	from?: string;
	to?: string;
	page: number;
	pageSize: number;
	sort: "asc" | "desc";
};

/** Параметры запроса трейсов. */
export type TracesQuery = {
	q?: string;
	from?: string;
	to?: string;
	page: number;
	pageSize: number;
	sort: "asc" | "desc";
};

/** Результат входа. */
export type LoginResult = { ok: true } | { ok: false; error: string };
