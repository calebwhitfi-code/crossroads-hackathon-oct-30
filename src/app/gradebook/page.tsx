import Link from "next/link";
import { GradeSummary } from "@/components/grade-summary";
import { visibleStudents } from "@/lib/gradebook";
import { courseGrade, formatCredits, formatGpa, formatGradingScale, formatPercentage, studentSummary } from "@/lib/grades";

export const metadata = { title: "Gradebook" };

export default async function GradebookPage() {
  const { profile, students } = await visibleStudents();
  return (
    <div className="space-y-9">
      <div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Progress, made clear</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your gradebook.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Approved grades, weighted and unweighted GPA, and earned credits. GPA includes current approved high-school grades; earned credits require a completed, passing course.</p></div>
      {students.map((student) => {
        const summary = studentSummary(student.courses);
        const years = [...new Set(student.courses.map((course) => course.academicYear))].sort().reverse();
        return (
          <section key={student.id} aria-labelledby={`gradebook-${student.id}`} className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 id={`gradebook-${student.id}`} className="text-xl font-semibold">{student.firstName} {student.lastName}</h2><p className="mt-1 text-xs text-muted">Cumulative / all school years</p></div>
              {profile.role === "parent" && <Link href={`/courses/new?student=${student.id}`} className="button-secondary">Add course</Link>}
            </div>
            <GradeSummary summary={summary} />
            <p className="text-xs leading-6 text-muted">Middle-school planned credits: {formatCredits(summary.middleSchoolCredits)} / excluded from high-school GPA and earned credits.</p>
            {years.map((year) => {
              const courses = student.courses.filter((course) => course.academicYear === year);
              const yearly = studentSummary(courses);
              return (
                <div key={year} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  <h3 className="text-lg font-semibold">{year}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted">Unweighted GPA <span className="text-accent">{formatGpa(yearly.unweightedGpa)}</span> / Weighted GPA <span className="text-accent">{formatGpa(yearly.weightedGpa)}</span> / Earned {formatCredits(yearly.earnedCredits)} of {formatCredits(yearly.plannedCredits)} planned HS credits / Middle-school planned {formatCredits(yearly.middleSchoolCredits)}</p>
                  <div className="mt-4 divide-y divide-border">
                    {courses.map((course) => {
                      const grade = courseGrade(course);
                      return (
                        <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                          <div className="min-w-0"><Link href={`/courses/${course.id}`} className="text-link break-words">{course.name}</Link>{course.curriculum && <p className="text-xs leading-5 break-words text-muted">{course.curriculum}</p>}<p className="mt-1 text-xs leading-5 text-muted">{formatCredits(course.credits)} credits / {course.completed ? "Complete" : "In progress"}{course.weighted ? " / Weighted" : ""}{course.gradeLevel < 9 ? " / Middle school" : ""}</p><p className="mt-1 text-xs leading-6 text-muted">{formatGradingScale(course)}</p></div>
                          <p className="text-sm font-semibold text-accent">{grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "No grades yet"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!student.courses.length && <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted">No courses yet. Add a course to begin tracking grades and credits.</p>}
          </section>
        );
      })}
      <aside className="rounded-xl border border-border p-5 text-xs leading-7 text-muted">
        <h2 className="font-semibold text-ink">How these numbers work</h2>
        <p>Default scale: A: 90-100% / B: 80-89.99% / C: 70-79.99% / D: 60-69.99% / F: below 60%. Each course can use a parent-approved curriculum scale, shown with the course. GPA points: 4 / 3 / 2 / 1 / 0. Passing weighted courses add 1 point. GPA is weighted by course credits and uses grades 9-12 only.</p>
        <p>Course percentages are a weighted average of category averages: Tests 50%, Quizzes 20%, Homework 30%. Each category is the average of its graded entries (each entry as a percentage of its possible points). If a category has no graded entries yet, its weight is shared proportionally among the categories that do. Ungraded and pending-review assignments are excluded, not treated as zero. Only the latest parent-approved submission for each assignment counts. Zero-credit courses do not affect GPA. A failed course (below its D cutoff) earns 0 credits but still counts in GPA at 0.0 points.</p>
      </aside>
    </div>
  );
}
