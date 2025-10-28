-- CreateTable AIProvider
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "customConfig" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "availableModels" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "testStatus" TEXT,
    "testError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable AITaskAssignment
CREATE TABLE "AITaskAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "fallbackProviderId" TEXT,
    "fallbackModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AITaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_organizationId_name_key" ON "AIProvider"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AIProvider_organizationId_idx" ON "AIProvider"("organizationId");

-- CreateIndex
CREATE INDEX "AIProvider_type_idx" ON "AIProvider"("type");

-- CreateIndex
CREATE INDEX "AIProvider_deletedAt_idx" ON "AIProvider"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AITaskAssignment_organizationId_taskType_key" ON "AITaskAssignment"("organizationId", "taskType");

-- CreateIndex
CREATE INDEX "AITaskAssignment_organizationId_idx" ON "AITaskAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "AITaskAssignment_taskType_idx" ON "AITaskAssignment"("taskType");

-- AddForeignKey
ALTER TABLE "AIProvider" ADD CONSTRAINT "AIProvider_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITaskAssignment" ADD CONSTRAINT "AITaskAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITaskAssignment" ADD CONSTRAINT "AITaskAssignment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITaskAssignment" ADD CONSTRAINT "AITaskAssignment_fallbackProviderId_fkey" FOREIGN KEY ("fallbackProviderId") REFERENCES "AIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
