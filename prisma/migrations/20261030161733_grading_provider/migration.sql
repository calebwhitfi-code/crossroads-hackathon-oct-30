ALTER TABLE "Submission" ADD COLUMN "gradingProvider" TEXT;
ALTER TABLE "Submission" ADD COLUMN "gradingNotice" TEXT;

UPDATE "Submission" SET "gradingProvider" = 'mock' WHERE "source" = 'vision';
