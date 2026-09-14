"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	getLogsAction,
	getTraceAction,
	getTracesAction,
	logoutAction,
} from "@/shared/services/logScopeService/actions";
import type {
	LogItem,
	Paginated,
	TraceDetail,
	TraceItem,
} from "@/shared/services/logScopeService/types";
import LogFilters, { type FiltersState, type TimePreset } from "./LogFilters";
import LogTable from "./LogTable";
import TraceList from "./TraceList";
import TraceWaterfall from "./TraceWaterfall";

const POLL_INTERVAL_MS = 5000;
const TRACE_PAGE_SIZE = 50;

type Tab = "logs" | "traces";

const TIME_PRESET_MS: Record<Exclude<TimePreset, "all" | "custom">, number> = {
	"5m": 5 * 60 * 1000,
	"1h": 60 * 60 * 1000,
	"24h": 24 * 60 * 60 * 1000,
	"7d": 7 * 24 * 60 * 60 * 1000,
};

function buildLogsQuery(filters: FiltersState, page: number, pageSize: number) {
	let from: string | undefined;
	let to: string | undefined;

	if (filters.timePreset === "custom") {
		from = filters.from ? new Date(filters.from).toISOString() : undefined;
		to = filters.to ? new Date(filters.to).toISOString() : undefined;
	} else if (filters.timePreset !== "all") {
		from = new Date(
			Date.now() - TIME_PRESET_MS[filters.timePreset],
		).toISOString();
	}

	return {
		page,
		pageSize,
		sort: "desc" as const,
		level: filters.level ? (filters.level as LogItem["level"]) : undefined,
		q: filters.q || undefined,
		attributes: filters.attributes
			.filter((a) => a.key.trim() && a.value.trim())
			.map((a) => ({ key: a.key.trim(), value: a.value.trim() })),
		from,
		to,
	};
}

export default function LogsView() {
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("logs");
	const [filters, setFilters] = useState<FiltersState>({
		level: "",
		q: "",
		attributes: [],
		timePreset: "all",
		from: "",
		to: "",
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [data, setData] = useState<Paginated<LogItem> | null>(null);
	const [traces, setTraces] = useState<Paginated<TraceItem> | null>(null);
	const [tracePage, setTracePage] = useState(1);
	const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const filtersRef = useRef(filters);
	filtersRef.current = filters;
	const pageRef = useRef(page);
	pageRef.current = page;
	const pageSizeRef = useRef(pageSize);
	pageSizeRef.current = pageSize;
	const tracePageRef = useRef(tracePage);
	tracePageRef.current = tracePage;

	const fetchLogs = useCallback(async () => {
		const query = buildLogsQuery(
			filtersRef.current,
			pageRef.current,
			pageSizeRef.current,
		);
		try {
			const result = await getLogsAction(query);
			setData(result);
			setError(null);
		} catch {
			setError("Сетевая ошибка");
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchTraces = useCallback(async () => {
		try {
			const result = await getTracesAction({
				page: tracePageRef.current,
				pageSize: TRACE_PAGE_SIZE,
				sort: "desc",
			});
			setTraces(result);
			setError(null);
		} catch {
			setError("Сетевая ошибка");
		}
	}, []);

	// Первичная загрузка + polling.
	useEffect(() => {
		fetchLogs();
		fetchTraces();
		const id = setInterval(() => {
			fetchLogs();
			fetchTraces();
		}, POLL_INTERVAL_MS);
		return () => clearInterval(id);
	}, [fetchLogs, fetchTraces]);

	function handleApplyFilters(next: FiltersState) {
		setFilters(next);
		setPage(1);
	}

	async function handleSelectTrace(traceId: string) {
		try {
			const detail = await getTraceAction(traceId);
			if (detail) {
				setSelectedTrace(detail);
				setError(null);
			} else {
				setError("Трейс не найден");
			}
		} catch {
			setError("Сетевая ошибка");
		}
	}

	async function handleLogout() {
		await logoutAction();
		router.push("/login");
		router.refresh();
	}

	const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
	const traceTotalPages = traces
		? Math.max(1, Math.ceil(traces.total / TRACE_PAGE_SIZE))
		: 1;

	return (
		<div className="container">
			<div className="page-header">
				<h1>Logscope</h1>
				<div style={{ display: "flex", gap: 8 }}>
					<button
						type="button"
						className="btn btn-danger"
						onClick={handleLogout}
					>
						Выйти
					</button>
				</div>
			</div>

			<div className="tabs" style={{ marginBottom: 16 }}>
				<button
					type="button"
					className={`tab ${tab === "logs" ? "tab-active" : ""}`}
					onClick={() => {
						setTab("logs");
						setSelectedTrace(null);
					}}
				>
					Логи
				</button>
				<button
					type="button"
					className={`tab ${tab === "traces" ? "tab-active" : ""}`}
					onClick={() => {
						setTab("traces");
						setSelectedTrace(null);
					}}
				>
					Трейсы
				</button>
			</div>

			{error && <div className="error-text">{error}</div>}

			{tab === "logs" && (
				<>
					<LogFilters initial={filters} onApply={handleApplyFilters} />

					{loading && !data ? (
						<div className="loading">Загрузка…</div>
					) : (
						<>
							<LogTable items={data?.items ?? []} />

							<div className="pagination">
								<span className="muted">
									Всего: {data?.total ?? 0} · Страница {page} из {totalPages}
								</span>
								<button
									type="button"
									className="btn btn-secondary"
									disabled={page <= 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									← Назад
								</button>
								<button
									type="button"
									className="btn btn-secondary"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									Вперёд →
								</button>
								<select
									className="select"
									value={pageSize}
									onChange={(e) => {
										setPageSize(Number(e.target.value));
										setPage(1);
									}}
								>
									<option value={25}>25</option>
									<option value={50}>50</option>
									<option value={100}>100</option>
									<option value={200}>200</option>
								</select>
							</div>
						</>
					)}
				</>
			)}

			{tab === "traces" &&
				(selectedTrace ? (
					<div>
						<div className="page-header">
							<h2 style={{ margin: 0, fontSize: 18 }}>
								Трейс {selectedTrace.trace.traceId}
							</h2>
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => setSelectedTrace(null)}
							>
								← К списку
							</button>
						</div>
						<div className="muted" style={{ marginBottom: 12 }}>
							{selectedTrace.trace.name} · {selectedTrace.trace.spanCount}{" "}
							спанов ·{" "}
							{selectedTrace.trace.durationMs != null
								? `${selectedTrace.trace.durationMs.toFixed(0)} мс`
								: "—"}
						</div>
						<TraceWaterfall spans={selectedTrace.spans} />
					</div>
				) : (
					<>
						<TraceList
							items={traces?.items ?? []}
							onSelect={handleSelectTrace}
						/>

						<div className="pagination">
							<span className="muted">
								Всего: {traces?.total ?? 0} · Страница {tracePage} из{" "}
								{traceTotalPages}
							</span>
							<button
								type="button"
								className="btn btn-secondary"
								disabled={tracePage <= 1}
								onClick={() => setTracePage((p) => Math.max(1, p - 1))}
							>
								← Назад
							</button>
							<button
								type="button"
								className="btn btn-secondary"
								disabled={tracePage >= traceTotalPages}
								onClick={() => setTracePage((p) => p + 1)}
							>
								Вперёд →
							</button>
						</div>
					</>
				))}
		</div>
	);
}
