"use client";

import { useState } from "react";

export type AttributeFilterRow = {
	id: string;
	key: string;
	value: string;
};

export type TimePreset = "all" | "5m" | "1h" | "24h" | "7d" | "custom";

export type FiltersState = {
	level: string;
	q: string;
	attributes: AttributeFilterRow[];
	timePreset: TimePreset;
	from: string;
	to: string;
};

const EMPTY: FiltersState = {
	level: "",
	q: "",
	attributes: [],
	timePreset: "all",
	from: "",
	to: "",
};

let attributeId = 0;
function nextAttributeId(): string {
	attributeId += 1;
	return `attr-${attributeId}`;
}

const TIME_PRESETS: { value: TimePreset; label: string }[] = [
	{ value: "all", label: "Всё время" },
	{ value: "5m", label: "5 минут" },
	{ value: "1h", label: "1 час" },
	{ value: "24h", label: "24 часа" },
	{ value: "7d", label: "7 дней" },
	{ value: "custom", label: "Свой диапазон" },
];

export default function LogFilters({
	initial,
	onApply,
}: {
	initial?: Partial<FiltersState>;
	onApply: (filters: FiltersState) => void;
}) {
	const [filters, setFilters] = useState<FiltersState>({
		...EMPTY,
		...initial,
	});

	function update<K extends keyof FiltersState>(
		key: K,
		value: FiltersState[K],
	) {
		setFilters((f) => ({ ...f, [key]: value }));
	}

	function updateAttribute(
		index: number,
		field: keyof AttributeFilterRow,
		value: string,
	) {
		setFilters((f) => {
			const attributes = f.attributes.map((row, i) =>
				i === index ? { ...row, [field]: value } : row,
			);
			return { ...f, attributes };
		});
	}

	function addAttribute() {
		setFilters((f) => ({
			...f,
			attributes: [
				...f.attributes,
				{ id: nextAttributeId(), key: "", value: "" },
			],
		}));
	}

	function removeAttribute(index: number) {
		setFilters((f) => ({
			...f,
			attributes: f.attributes.filter((_, i) => i !== index),
		}));
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onApply(filters);
	}

	function handleReset() {
		setFilters(EMPTY);
		onApply(EMPTY);
	}

	return (
		<form className="filters" onSubmit={handleSubmit}>
			<div className="field">
				<label htmlFor="f-level">Уровень</label>
				<select
					id="f-level"
					className="select"
					value={filters.level}
					onChange={(e) => update("level", e.target.value)}
				>
					<option value="">Все</option>
					<option value="info">info</option>
					<option value="warn">warn</option>
					<option value="error">error</option>
				</select>
			</div>

			<div className="field">
				<label htmlFor="f-q">Поиск по сообщению</label>
				<input
					id="f-q"
					className="input"
					type="text"
					value={filters.q}
					onChange={(e) => update("q", e.target.value)}
					placeholder="текст в message"
				/>
			</div>

			<div className="field field-wide">
				<span className="field-label">Атрибуты (additionals)</span>
				<div className="attr-filters">
					{filters.attributes.length === 0 && (
						<span className="muted">Фильтров по атрибутам нет</span>
					)}
					{filters.attributes.map((row, index) => (
						<div className="attr-row" key={row.id}>
							<input
								className="input"
								type="text"
								value={row.key}
								onChange={(e) => updateAttribute(index, "key", e.target.value)}
								placeholder="ключ (напр. category, user.id)"
							/>
							<span className="muted">=</span>
							<input
								className="input"
								type="text"
								value={row.value}
								onChange={(e) =>
									updateAttribute(index, "value", e.target.value)
								}
								placeholder="значение"
							/>
							<button
								className="btn btn-secondary"
								type="button"
								onClick={() => removeAttribute(index)}
								title="Удалить фильтр"
							>
								✕
							</button>
						</div>
					))}
					<button
						className="btn btn-secondary"
						type="button"
						onClick={addAttribute}
					>
						+ Добавить фильтр
					</button>
				</div>
			</div>

			<div className="field field-wide">
				<label htmlFor="f-time">Время</label>
				<div className="time-row">
					<select
						id="f-time"
						className="select"
						value={filters.timePreset}
						onChange={(e) => update("timePreset", e.target.value as TimePreset)}
					>
						{TIME_PRESETS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>

					{filters.timePreset === "custom" && (
						<div className="time-range">
							<input
								className="input"
								type="datetime-local"
								value={filters.from}
								onChange={(e) => update("from", e.target.value)}
							/>
							<span className="muted">—</span>
							<input
								className="input"
								type="datetime-local"
								value={filters.to}
								onChange={(e) => update("to", e.target.value)}
							/>
						</div>
					)}
				</div>
			</div>

			<button className="btn" type="submit">
				Применить
			</button>
			<button className="btn btn-secondary" type="button" onClick={handleReset}>
				Сбросить
			</button>
		</form>
	);
}
