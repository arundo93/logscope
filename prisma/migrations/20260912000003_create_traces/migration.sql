-- CreateTable: traces (агрегированная запись трейса)
CREATE TABLE "traces" (
    "id" BIGSERIAL NOT NULL,
    "trace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "span_count" INTEGER NOT NULL DEFAULT 0,
    "status_code" SMALLINT,
    "start_time" TIMESTAMP(6) NOT NULL,
    "end_time" TIMESTAMP(6) NOT NULL,
    "duration_ms" DOUBLE PRECISION,
    "attributes" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traces_trace_id_key" ON "traces"("trace_id");

-- CreateIndex
CREATE INDEX "traces_start_time_idx" ON "traces"("start_time" DESC);