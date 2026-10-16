import { createPrismaClient } from "./client.mjs";

const prisma = createPrismaClient();

const families = [
  {
    id: "family-parker", name: "Parker Family",
    students: [
      {
        id: "student-ava", firstName: "Ava", lastName: "Parker", gradeLevel: 10, graduationYear: 2029,
        courses: [
          ["ava-english", "English II", "Language arts", 1, false, 94, "Literary analysis: character and conflict", "Family literature and composition"],
          ["ava-algebra", "Algebra II", "Mathematics", 1, true, 88, "Quadratic equations", "Saxon Math - Algebra 2"],
          ["ava-biology", "Biology", "Science", 1, false, 91, "Cell structure and function", "Apologia Biology"],
        ],
      },
      {
        id: "student-noah", firstName: "Noah", lastName: "Parker", gradeLevel: 8, graduationYear: 2031,
        courses: [
          ["noah-prealgebra", "Pre-Algebra", "Mathematics", 0.5, false, 86, "Ratios and proportions", "Saxon Math - Algebra 1/2"],
          ["noah-history", "U.S. History", "Social studies", 0.5, false, 93, "The Constitutional Convention", "Notgrass History - America the Beautiful"],
        ],
      },
    ],
  },
  {
    id: "family-rivera", name: "Rivera Family",
    students: [
      {
        id: "student-elena", firstName: "Elena", lastName: "Rivera", gradeLevel: 11, graduationYear: 2028,
        courses: [
          ["elena-literature", "American Literature", "Language arts", 1, true, 96, "Poetry close reading", "American literature reading list"],
          ["elena-chemistry", "Chemistry", "Science", 1, false, 89, "Balancing chemical equations", "Apologia Chemistry"],
          ["elena-spanish", "Spanish III", "World languages", 1, false, 92, "Past-tense narrative", "Family Spanish III"],
        ],
      },
    ],
  },
];

// Stable IDs preserve existing work; new curriculum labels only fill missing values.
async function seed() {
  await prisma.$transaction(async (db) => {
    for (const family of families) {
      await db.family.upsert({
        where: { id: family.id }, update: {},
        create: { id: family.id, name: family.name },
      });
      for (const student of family.students) {
        const { courses, ...details } = student;
        await db.student.upsert({
          where: { id: student.id }, update: {},
          create: { ...details, familyId: family.id },
        });
        for (const [id, name, subject, credits, weighted, points, title, curriculum] of courses) {
          await db.course.upsert({
            where: { id }, update: {},
            create: {
              id, name, subject, curriculum, credits, weighted,
              studentId: student.id, gradeLevel: student.gradeLevel, academicYear: "2026-2027",
            },
          });
          await db.course.updateMany({
            where: { id, curriculum: null },
            data: { curriculum },
          });
          await db.assignment.upsert({
            where: { id: `${id}-assignment` }, update: {},
            create: {
              id: `${id}-assignment`, courseId: id, title, maxPoints: 100,
              description: "Completed demo assignment with a parent-approved manual grade.",
              dueAt: new Date("2026-10-12T16:00:00Z"),
            },
          });
          await db.submission.upsert({
            where: { id: `${id}-submission` }, update: {},
            create: {
              id: `${id}-submission`, assignmentId: `${id}-assignment`, source: "manual",
              earnedPoints: points, letterGrade: points >= 90 ? "A" : "B",
              feedback: points >= 90
                ? "Clear understanding and thoughtful work. Keep explaining your reasoning."
                : "Good progress. Review the marked steps and check your final answers.",
              status: "approved", approvedAt: new Date("2026-10-13T15:00:00Z"),
            },
          });
        }
      }
    }
  });
  console.log("Demo data ready: 2 families, 3 students, 8 courses and 8 approved manual grades.");
}

try {
  await seed();
} catch (error) {
  console.error("Could not seed the demo database:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
