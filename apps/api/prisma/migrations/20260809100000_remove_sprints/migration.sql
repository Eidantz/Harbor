-- Remove sprint activity rows before shrinking the ActivityType enum
DELETE FROM "ActivityEvent" WHERE "type" = 'sprint_changed';

-- Recreate ActivityType without sprint_changed
CREATE TYPE "ActivityType_new" AS ENUM ('created', 'updated', 'moved', 'linked', 'commented');
ALTER TABLE "ActivityEvent" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "ActivityType_old";

-- Drop sprint references from Issue
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_sprintId_fkey";
DROP INDEX "Issue_sprintId_idx";
DROP INDEX "Issue_projectId_sprintId_rank_idx";
ALTER TABLE "Issue" DROP COLUMN "sprintId";

-- Drop the Sprint table and its enum
DROP TABLE "Sprint";
DROP TYPE "SprintState";
