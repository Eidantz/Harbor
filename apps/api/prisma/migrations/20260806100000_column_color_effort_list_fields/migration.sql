-- AlterTable
ALTER TABLE "Project" ADD COLUMN "listFields" JSONB NOT NULL DEFAULT '["key","title","priority","humanEffort","locEffort","type","labels","blockers"]';

-- AlterTable
ALTER TABLE "BoardColumn" ADD COLUMN "color" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "humanEffort" DOUBLE PRECISION;
ALTER TABLE "Issue" ADD COLUMN "locEffort" INTEGER;
