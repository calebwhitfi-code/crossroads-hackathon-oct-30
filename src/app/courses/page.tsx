import type { Metadata } from "next";
import Link from "next/link";
import { visibleStudents } from "@/lib/gradebook";
import { courseGrade, formatCredits, formatPercentage } from "@/lib/grades";
import { SaveNotice } from "@/components/save-notice";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { profile, students } = await visibleStudents();

  return (
    <div className="space-y-8">
      <SaveNotice saved={(await searchParams).saved} />
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">The learning space</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">A place for every subject.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{profile.role === "parent" ? "Manage courses, curriculum, assignments, and parent-approved grades across school years." : "Explore your courses, curriculum, and parent-approved grades. Your workspace is read-only."}</p>
        {profile.role === "parent" && <Link href="/courses/new" className="button-primary mt-5">Add course</Link>}
      </div>
      {students.map((student) => (
        <section key={student.id} aria-labelledby={`heading-${student.id}`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`heading-${student.id}`} className="text-xl font-semibold">{student.firstName} {student.lastName}</h2>
            <p className="text-sm text-muted">Grade {student.gradeLevel} / {student.courses.length} courses</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {student.courses.map((course) => {
              const grade = courseGrade(course);
              return (
              <article key={course.id} className="flex flex-col rounded-xl border border-border bg-card p-6">
                <p className="text-xs text-muted">{course.subject}</p>
                <h3 className="mt-3 text-lg font-semibold">{course.name}</h3>
                {course.curriculum && <p className="mt-1 text-xs leading-5 text-muted">{course.curriculum}</p>}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg border border-border bg-raised px-2 py-1">{formatCredits(course.credits)} {course.credits === 1 ? "credit" : "credits"}</span>
                  {course.weighted && <span className="rounded-lg border border-border px-2 py-1 text-accent">Weighted</span>}
                </div>
                <p className="mt-4 text-sm font-semibold text-accent">{grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "Not graded"}</p>
                <p className="mt-2 text-xs leading-6 text-muted">{course.assignments.length} assignments / {course.academicYear} / {course.completed ? "Complete" : "In progress"}</p>
                <div className="mt-auto flex flex-wrap gap-4 border-t border-border pt-3">
                  <Link href={`/courses/${course.id}`} className="text-link" aria-label={`Open ${course.name}`}>Open course</Link>
                  {profile.role === "parent" && <Link href={`/courses/${course.id}/edit`} className="text-link" aria-label={`Edit ${course.name}`}>Edit</Link>}
                </div>
              </article>
              );
            })}
          </div>
          {student.courses.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted">No courses yet.{profile.role === "parent" ? " Add a course to start tracking this student's learning." : " Your parent can add courses here."}</p>}
        </section>
      ))}
    </div>
  );
}
