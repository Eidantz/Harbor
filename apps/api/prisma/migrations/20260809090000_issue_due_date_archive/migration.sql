-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "Issue" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Issue_projectId_archivedAt_idx" ON "Issue"("projectId", "archivedAt");
