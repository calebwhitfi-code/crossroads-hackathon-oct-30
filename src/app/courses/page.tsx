import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage() {
  const profile = await getProfileContext();
  const students = await db.student.findMany({
    where: { familyId: profile.family.id, ...(profile.student ? { id: profile.student.id } : {}) },
    orderBy: { firstName: "asc" },
    include: { courses: { orderBy: { name: "asc" }, include: { _count: { select: { assignments: true } } } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">The learning space</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">A place for every subject.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted">Your seeded courses for 2026-2027. Course editing, assignments, and manual grade entry arrive with the Phase 2 gradebook.</p>
      </div>
      {students.map((student) => (
        <section key={student.id} aria-labelledby={`heading-${student.id}`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`heading-${student.id}`} className="text-xl font-semibold">{student.firstName} {student.lastName}</h2>
            <p className="text-sm text-muted">Grade {student.gradeLevel} / {student.courses.length} courses</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {student.courses.map((course) => (
              <article key={course.id} className="flex flex-col rounded-xl border border-border bg-card p-6">
                <p className="text-xs text-muted">{course.subject}</p>
                <h3 className="mt-3 text-lg font-semibold">{course.name}</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg border border-border bg-raised px-2 py-1">{course.credits} {course.credits === 1 ? "credit" : "credits"}</span>
                  {course.weighted && <span className="rounded-lg border border-border px-2 py-1 text-accent">Weighted</span>}
                </div>
                <p className="mt-6 border-t border-border pt-4 text-xs leading-6 text-muted">{course._count.assignments} seeded assignment / {course.academicYear}</p>
              </article>
            ))}
          </div>
          {student.courses.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted">No courses yet. Course creation arrives in Phase 2.</p>}
        </section>
      ))}
    </div>
  );
}
