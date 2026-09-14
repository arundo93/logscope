-- CreateTable
CREATE TABLE "log_entries" (
    "id" BIGSERIAL NOT NULL,
    "level" VARCHAR(16) NOT NULL,
    "message" TEXT NOT NULL,
    "additionals" JSONB DEFAULT '{}',
    "client_log_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_entries_created_at_idx" ON "log_entries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "log_entries_level_created_at_idx" ON "log_entries"("level", "created_at" DESC);