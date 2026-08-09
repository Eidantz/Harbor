-- AlterTable
ALTER TABLE "Epic" ADD COLUMN "document" TEXT;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "document" TEXT;

-- Existing descriptions longer than the new 300-char summary limit are moved
-- into the document field, keeping a truncated first-line summary.
UPDATE "Epic"
SET "document" = "description",
    "description" = left(split_part("description", E'\n', 1), 300)
WHERE "description" IS NOT NULL AND length("description") > 300;

UPDATE "Issue"
SET "document" = "description",
    "description" = left(split_part("description", E'\n', 1), 300)
WHERE "description" IS NOT NULL AND length("description") > 300;
