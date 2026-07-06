-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GMAIL');

-- CreateEnum
CREATE TYPE "MailAccountSyncStatus" AS ENUM ('ACTIVE', 'AUTH_ERROR', 'RESYNC_NEEDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "MailSyncCursorKind" AS ENUM ('GMAIL_HISTORY_ID', 'MS_GRAPH_DELTA_LINK');

-- CreateEnum
CREATE TYPE "MailSyncScopeType" AS ENUM ('MAILBOX', 'FOLDER');

-- CreateTable
CREATE TABLE "mail_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authAccountId" TEXT,
    "providerAccountId" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL DEFAULT 'GMAIL',
    "email" TEXT NOT NULL,
    "syncStatus" "MailAccountSyncStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMailboxActivityAt" TIMESTAMP(3),
    "watchExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_sync_cursor" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "cursorKind" "MailSyncCursorKind" NOT NULL,
    "scopeType" "MailSyncScopeType" NOT NULL,
    "providerScopeId" TEXT NOT NULL,
    "cursorValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_sync_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_sync_lock" (
    "id" TEXT NOT NULL,
    "mailSyncCursorId" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_sync_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_thread" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "latestMessageId" TEXT,
    "latestMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "isRead" BOOLEAN NOT NULL DEFAULT true,
    "isInbox" BOOLEAN NOT NULL DEFAULT false,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isTrash" BOOLEAN NOT NULL DEFAULT false,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_message" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "mailThreadId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "rfc822MessageId" TEXT,
    "inReplyToHeader" TEXT,
    "referencesHeader" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toRecipients" JSONB NOT NULL,
    "ccRecipients" JSONB NOT NULL,
    "bccRecipients" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "sizeEstimate" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_label" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "providerLabelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_message_label" (
    "id" TEXT NOT NULL,
    "mailMessageId" TEXT NOT NULL,
    "mailLabelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_message_label_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_account_userId_idx" ON "mail_account"("userId");

-- CreateIndex
CREATE INDEX "mail_account_authAccountId_idx" ON "mail_account"("authAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_account_userId_provider_providerAccountId_key" ON "mail_account"("userId", "provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "mail_sync_cursor_mailAccountId_idx" ON "mail_sync_cursor"("mailAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_sync_cursor_mailAccountId_cursorKind_scopeType_providerScopeId_key" ON "mail_sync_cursor"("mailAccountId", "cursorKind", "scopeType", "providerScopeId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_sync_lock_mailSyncCursorId_key" ON "mail_sync_lock"("mailSyncCursorId");

-- CreateIndex
CREATE INDEX "mail_sync_lock_lockedUntil_idx" ON "mail_sync_lock"("lockedUntil");

-- CreateIndex
CREATE INDEX "mail_thread_mailAccountId_latestMessageAt_idx" ON "mail_thread"("mailAccountId", "latestMessageAt");

-- CreateIndex
CREATE INDEX "mail_thread_latestMessageId_idx" ON "mail_thread"("latestMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_thread_mailAccountId_providerThreadId_key" ON "mail_thread"("mailAccountId", "providerThreadId");

-- CreateIndex
CREATE INDEX "mail_message_mailAccountId_sentAt_idx" ON "mail_message"("mailAccountId", "sentAt");

-- CreateIndex
CREATE INDEX "mail_message_mailThreadId_sentAt_idx" ON "mail_message"("mailThreadId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "mail_message_mailAccountId_providerMessageId_key" ON "mail_message"("mailAccountId", "providerMessageId");

-- CreateIndex
CREATE INDEX "mail_label_mailAccountId_idx" ON "mail_label"("mailAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_label_mailAccountId_providerLabelId_key" ON "mail_label"("mailAccountId", "providerLabelId");

-- CreateIndex
CREATE INDEX "mail_message_label_mailLabelId_idx" ON "mail_message_label"("mailLabelId");

-- CreateIndex
CREATE UNIQUE INDEX "mail_message_label_mailMessageId_mailLabelId_key" ON "mail_message_label"("mailMessageId", "mailLabelId");

-- AddForeignKey
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_account" ADD CONSTRAINT "mail_account_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sync_cursor" ADD CONSTRAINT "mail_sync_cursor_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_sync_lock" ADD CONSTRAINT "mail_sync_lock_mailSyncCursorId_fkey" FOREIGN KEY ("mailSyncCursorId") REFERENCES "mail_sync_cursor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_thread" ADD CONSTRAINT "mail_thread_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_thread" ADD CONSTRAINT "mail_thread_latestMessageId_fkey" FOREIGN KEY ("latestMessageId") REFERENCES "mail_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_mailThreadId_fkey" FOREIGN KEY ("mailThreadId") REFERENCES "mail_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_label" ADD CONSTRAINT "mail_label_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "mail_message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_message_label" ADD CONSTRAINT "mail_message_label_mailLabelId_fkey" FOREIGN KEY ("mailLabelId") REFERENCES "mail_label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
