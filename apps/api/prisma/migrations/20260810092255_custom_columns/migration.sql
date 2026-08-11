-- CreateEnum
CREATE TYPE "CustomColumnType" AS ENUM ('text', 'number', 'date', 'label', 'person', 'file', 'checkbox');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "listWidths" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "CustomColumn" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomColumnType" NOT NULL,
    "position" INTEGER NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueCustomValue" (
    "issueId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "IssueCustomValue_pkey" PRIMARY KEY ("issueId","columnId")
);

-- CreateIndex
CREATE INDEX "CustomColumn_projectId_idx" ON "CustomColumn"("projectId");

-- CreateIndex
CREATE INDEX "CustomColumn_projectId_position_idx" ON "CustomColumn"("projectId", "position");

-- CreateIndex
CREATE INDEX "IssueCustomValue_columnId_idx" ON "IssueCustomValue"("columnId");

-- AddForeignKey
ALTER TABLE "CustomColumn" ADD CONSTRAINT "CustomColumn_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueCustomValue" ADD CONSTRAINT "IssueCustomValue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueCustomValue" ADD CONSTRAINT "IssueCustomValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "CustomColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
