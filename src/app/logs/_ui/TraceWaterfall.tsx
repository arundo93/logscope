"use client";

import { useMemo, useState } from "react";
import type { WaterfallSpan } from "@/shared/services/logScopeService/types";

type SpanNode = WaterfallSpan & {
	children: SpanNode[];
	depth: number;
};

const KIND_LABEL: Record<number, string> = {
	0: "unspecified",
	1: "internal",
	2: "server",
	3: "client",
	4: "producer",
	5: "consumer",
};

function formatDuration(ms: number | null): string {
	if (ms == null) return "—";
	if (ms < 1000) return `${ms.toFixed(0)} мс`;
	return `${(ms / 1000).toFixed(2)} с`;
}

function buildTree(spans: WaterfallSpan[]): SpanNode[] {
	const byId = new Map<string, SpanNode>();
	const roots: SpanNode[] = [];

	for (const s of spans) {
		byId.set(s.spanId, { ...s, children: [], depth: 0 });
	}

	for (const node of byId.values()) {
		if (node.parentSpanId && byId.has(node.parentSpanId)) {
			byId.get(node.parentSpanId)?.children.push(node);
		} else {
			roots.push(node);
		}
	}

	// Вычисляем глубину.
	const assignDepth = (nodes: SpanNode[], depth: number) => {
		for (const n of nodes) {
			n.depth = depth;
			assignDepth(n.children, depth + 1);
		}
	};
	assignDepth(roots, 0);

	return roots;
}

function SpanRow({
	node,
	traceStart,
	traceDuration,
}: {
	node: SpanNode;
	traceStart: number;
	traceDuration: number;
}) {
	const [open, setOpen] = useState(false);
	const start = new Date(node.startTime).getTime();
	const duration = node.durationMs ?? 0;

	const leftPct =
		traceDuration > 0 ? ((start - traceStart) / traceDuration) * 100 : 0;
	const widthPct = traceDuration > 0 ? (duration / traceDuration) * 100 : 0;

	const hasChildren = node.children.length > 0;

	return (
		<>
			<tr>
				<td style={{ paddingLeft: 8 + node.depth * 20 }}>
					{hasChildren && (
						<button
							type="button"
							className="btn btn-secondary"
							style={{ padding: "0 6px", marginRight: 6, fontSize: 12 }}
							onClick={() => setOpen((o) => !o)}
						>
							{open ? "−" : "+"}
						</button>
					)}
					<span className="log-message">{node.name}</span>
					<span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
						{KIND_LABEL[node.kind] ?? node.kind}
					</span>
				</td>
				<td style={{ width: 200 }}>
					<div className="waterfall-track">
						<div
							className={`waterfall-bar ${
								node.statusCode === 2 ? "waterfall-bar-error" : ""
							}`}
							style={{
								left: `${Math.max(0, Math.min(100, leftPct))}%`,
								width: `${Math.max(1, Math.min(100 - leftPct, widthPct))}%`,
							}}
						/>
					</div>
				</td>
				<td style={{ width: 100 }} className="log-time">
					{formatDuration(node.durationMs)}
				</td>
			</tr>
			{open && (
				<tr>
					<td colSpan={3} style={{ paddingLeft: 8 + node.depth * 20 }}>
						<pre className="log-additionals">
							{JSON.stringify(
								{
									spanId: node.spanId,
									parentSpanId: node.parentSpanId,
									statusCode: node.statusCode,
									statusMessage: node.statusMessage,
									attributes: node.attributes,
									events: node.events,
								},
								null,
								2,
							)}
						</pre>
					</td>
				</tr>
			)}
			{node.children.map((child) => (
				<SpanRow
					key={child.spanId}
					node={child}
					traceStart={traceStart}
					traceDuration={traceDuration}
				/>
			))}
		</>
	);
}

export default function TraceWaterfall({ spans }: { spans: WaterfallSpan[] }) {
	const tree = useMemo(() => buildTree(spans), [spans]);

	if (spans.length === 0) {
		return <div className="loading">Спанов нет</div>;
	}

	const traceStart = Math.min(
		...spans.map((s) => new Date(s.startTime).getTime()),
	);
	const traceEnd = Math.max(...spans.map((s) => new Date(s.endTime).getTime()));
	const traceDuration = Math.max(1, traceEnd - traceStart);

	return (
		<div className="panel" style={{ overflowX: "auto" }}>
			<table className="log-table">
				<thead>
					<tr>
						<th>Спан</th>
						<th style={{ width: 200 }}>Таймлайн</th>
						<th style={{ width: 100 }}>Длительность</th>
					</tr>
				</thead>
				<tbody>
					{tree.map((node) => (
						<SpanRow
							key={node.spanId}
							node={node}
							traceStart={traceStart}
							traceDuration={traceDuration}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}
