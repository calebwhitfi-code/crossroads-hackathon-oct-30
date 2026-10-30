-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" REAL NOT NULL DEFAULT 100,
    "category" TEXT NOT NULL DEFAULT 'homework',
    "dueAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "rubricId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("courseId", "createdAt", "description", "dueAt", "id", "maxPoints", "rubricId", "title", "version") SELECT "courseId", "createdAt", "description", "dueAt", "id", "maxPoints", "rubricId", "title", "version" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_courseId_dueAt_idx" ON "Assignment"("courseId", "dueAt");
CREATE INDEX "Assignment_rubricId_idx" ON "Assignment"("rubricId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
