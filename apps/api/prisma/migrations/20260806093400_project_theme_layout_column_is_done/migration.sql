-- CreateEnum
CREATE TYPE "BoardLayout" AS ENUM ('columns', 'list');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'tokyo-night',
ADD COLUMN     "boardLayout" "BoardLayout" NOT NULL DEFAULT 'columns';

-- AlterTable
ALTER TABLE "BoardColumn" ADD COLUMN     "isDone" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing Done columns are the done column for soft blockers / sprint close
UPDATE "BoardColumn" SET "isDone" = true WHERE name = 'Done';
