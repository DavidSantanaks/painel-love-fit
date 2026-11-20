-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'ADMIN', 'RECEPTION');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "NodeAction" AS ENUM ('NONE', 'CALL_HUMAN', 'PAUSE');

-- CreateEnum
CREATE TYPE "OptionAction" AS ENUM ('GO_TO', 'CALL_HUMAN', 'PAUSE', 'NONE');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'PAUSED', 'WAITING_HUMAN');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECEPTION',
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "hours" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "showOptions" BOOLEAN NOT NULL DEFAULT true,
    "onEnterAction" "NodeAction" NOT NULL DEFAULT 'NONE',
    "pauseMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeMessage" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT NOT NULL DEFAULT '',
    "mediaId" TEXT,

    CONSTRAINT "NodeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "triggers" TEXT[],
    "action" "OptionAction" NOT NULL DEFAULT 'GO_TO',
    "targetNodeId" TEXT,
    "pauseMinutes" INTEGER,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "franchiseId" TEXT NOT NULL,
    "pauseMinutes" INTEGER NOT NULL DEFAULT 60,
    "floodWindowSeconds" INTEGER NOT NULL DEFAULT 5,
    "typingDelayMs" INTEGER NOT NULL DEFAULT 1500,
    "betweenMessagesMs" INTEGER NOT NULL DEFAULT 800,
    "reactivationWords" TEXT[] DEFAULT ARRAY['0', 'menu', '#menu', 'voltar']::TEXT[],
    "staffCommands" TEXT[] DEFAULT ARRAY['#pausa', '#parar', '#silenciar']::TEXT[],
    "notifyCooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "outOfHoursMessage" TEXT NOT NULL DEFAULT '',
    "respondUnresolvedLid" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("franchiseId")
);

-- CreateTable
CREATE TABLE "BlacklistEntry" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotifyNumber" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotifyNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "remoteJid" TEXT NOT NULL,
    "phone" TEXT,
    "pushName" TEXT NOT NULL DEFAULT '',
    "currentNodeKey" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedUntil" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffRequest" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "HandoffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "contactPhone" TEXT,
    "direction" "Direction" NOT NULL,
    "decision" TEXT NOT NULL,
    "nodeKey" TEXT,
    "optionLabel" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_slug_key" ON "Franchise"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_franchiseId_idx" ON "User"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_name_key" ON "Instance"("name");

-- CreateIndex
CREATE INDEX "Instance_franchiseId_idx" ON "Instance"("franchiseId");

-- CreateIndex
CREATE INDEX "Node_franchiseId_idx" ON "Node"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "Node_franchiseId_key_key" ON "Node"("franchiseId", "key");

-- CreateIndex
CREATE INDEX "NodeMessage_nodeId_idx" ON "NodeMessage"("nodeId");

-- CreateIndex
CREATE INDEX "NodeMessage_franchiseId_idx" ON "NodeMessage"("franchiseId");

-- CreateIndex
CREATE INDEX "Option_nodeId_idx" ON "Option"("nodeId");

-- CreateIndex
CREATE INDEX "Option_franchiseId_idx" ON "Option"("franchiseId");

-- CreateIndex
CREATE INDEX "Media_franchiseId_idx" ON "Media"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistEntry_franchiseId_phone_key" ON "BlacklistEntry"("franchiseId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "NotifyNumber_franchiseId_phone_key" ON "NotifyNumber"("franchiseId", "phone");

-- CreateIndex
CREATE INDEX "Contact_franchiseId_updatedAt_idx" ON "Contact"("franchiseId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_instanceId_remoteJid_key" ON "Contact"("instanceId", "remoteJid");

-- CreateIndex
CREATE INDEX "HandoffRequest_franchiseId_resolvedAt_idx" ON "HandoffRequest"("franchiseId", "resolvedAt");

-- CreateIndex
CREATE INDEX "MessageLog_franchiseId_createdAt_idx" ON "MessageLog"("franchiseId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_createdAt_idx" ON "MessageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_franchiseId_createdAt_idx" ON "AuditLog"("franchiseId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeMessage" ADD CONSTRAINT "NodeMessage_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeMessage" ADD CONSTRAINT "NodeMessage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlacklistEntry" ADD CONSTRAINT "BlacklistEntry_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotifyNumber" ADD CONSTRAINT "NotifyNumber_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffRequest" ADD CONSTRAINT "HandoffRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

