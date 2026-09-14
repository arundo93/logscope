import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

/**
 * Сервис работы с таблицами traces и spans.
 */
export class TracesService {
	/** Список трейсов с пагинацией. Возвращает { items, total }. */
	async findMany(params: {
		where: Prisma.TraceWhereInput;
		orderBy: Prisma.TraceOrderByWithRelationInput;
		page: number;
		pageSize: number;
	}) {
		const { where, orderBy, page, pageSize } = params;
		const [items, total] = await Promise.all([
			prisma.trace.findMany({
				where,
				orderBy,
				skip: (page - 1) * pageSize,
				take: pageSize,
			}),
			prisma.trace.count({ where }),
		]);
		return { items, total };
	}

	/** Полный трейс: агрегат + все спаны. */
	async findTraceWithSpans(traceId: string) {
		const [trace, spans] = await Promise.all([
			prisma.trace.findUnique({ where: { traceId } }),
			prisma.span.findMany({
				where: { traceId },
				orderBy: { startTime: "asc" },
			}),
		]);
		return { trace, spans };
	}

	/** Upsert агрегата трейса + batch insert спанов (OTLP-приём). */
	async upsertTraceWithSpans(params: {
		trace: Prisma.TraceCreateInput;
		spans: Prisma.SpanCreateManyInput[];
	}): Promise<void> {
		const { trace, spans } = params;
		await prisma.$transaction([
			prisma.trace.upsert({
				where: { traceId: trace.traceId },
				create: trace,
				update: trace,
			}),
			prisma.span.createMany({
				data: spans,
				skipDuplicates: true,
			}),
		]);
	}
}
