-- AlterTable: добавить OTEL-поля в log_entries
ALTER TABLE "log_entries" ADD COLUMN "severity_number" INTEGER,
ADD COLUMN "trace_id" TEXT,
ADD COLUMN "span_id" TEXT;

-- CreateIndex
CREATE INDEX "log_entries_trace_id_idx" ON "log_entries"("trace_id");