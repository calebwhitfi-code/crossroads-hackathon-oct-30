-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" REAL NOT NULL DEFAULT 100,
    "dueAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "rubricId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("courseId", "createdAt", "description", "dueAt", "id", "maxPoints", "rubricId", "title") SELECT "courseId", "createdAt", "description", "dueAt", "id", "maxPoints", "rubricId", "title" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_courseId_dueAt_idx" ON "Assignment"("courseId", "dueAt");
CREATE INDEX "Assignment_rubricId_idx" ON "Assignment"("rubricId");
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "curriculum" TEXT,
    "credits" REAL NOT NULL,
    "weighted" BOOLEAN NOT NULL DEFAULT false,
    "gradeLevel" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Course_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Course" ("academicYear", "createdAt", "credits", "curriculum", "gradeLevel", "id", "name", "studentId", "subject", "weighted") SELECT "academicYear", "createdAt", "credits", "curriculum", "gradeLevel", "id", "name", "studentId", "subject", "weighted" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE INDEX "Course_studentId_academicYear_idx" ON "Course"("studentId", "academicYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
