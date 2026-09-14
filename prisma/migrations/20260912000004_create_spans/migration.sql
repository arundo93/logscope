-- CreateTable: spans (отдельные спаны трейса)
CREATE TABLE "spans" (
    "id" BIGSERIAL NOT NULL,
    "trace_id" TEXT NOT NULL,
    "span_id" TEXT NOT NULL,
    "parent_span_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" SMALLINT NOT NULL DEFAULT 1,
    "status_code" SMALLINT,
    "status_message" TEXT,
    "start_time" TIMESTAMP(6) NOT NULL,
    "end_time" TIMESTAMP(6) NOT NULL,
    "duration_ms" DOUBLE PRECISION,
    "attributes" JSONB DEFAULT '{}',
    "events" JSONB DEFAULT '[]',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spans_trace_id_span_id_key" ON "spans"("trace_id", "span_id");

-- CreateIndex
CREATE INDEX "spans_trace_id_idx" ON "spans"("trace_id");

-- CreateIndex
CREATE INDEX "spans_parent_span_id_idx" ON "spans"("parent_span_id");

-- CreateIndex
CREATE INDEX "spans_start_time_idx" ON "spans"("start_time" DESC);