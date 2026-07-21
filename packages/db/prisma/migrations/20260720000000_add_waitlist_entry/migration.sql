-- CreateTable
CREATE TABLE "waitlist_entry" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entry_normalizedEmail_key" ON "waitlist_entry"("normalizedEmail");

-- CreateIndex
CREATE INDEX "waitlist_entry_createdAt_idx" ON "waitlist_entry"("createdAt");

-- CreateIndex
CREATE INDEX "waitlist_entry_ipHash_createdAt_idx" ON "waitlist_entry"("ipHash", "createdAt");
