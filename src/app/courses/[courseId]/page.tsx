import Link from "next/link";
import { ManualGradeForm } from "@/components/gradebook-forms";
import { SaveNotice } from "@/components/save-notice";
import { visibleCourse } from "@/lib/gradebook";
import { CATEGORY_LABELS, courseGrade, formatCredits, formatPercentage, latestApproved } from "@/lib/grades";

export const metadata = { title: "Course gradebook" };

export default async function CoursePage({ params, searchParams }: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { profile, course } = await visibleCourse((await params).courseId);
  const grade = courseGrade(course);
  const editable = profile.role === "parent" && !course.completed;
  return (
    <div className="space-y-7">
      <SaveNotice saved={(await searchParams).saved} />
      <div>
        <Link href="/courses" className="text-link">Back to courses</Link>
        <p className="mt-4 text-xs tracking-widest text-muted uppercase">{course.subject}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{course.name}</h1>
        {course.curriculum && <p className="mt-2 text-sm text-muted">{course.curriculum}</p>}
        <p className="mt-4 text-sm leading-6 text-muted">{course.student.firstName} {course.student.lastName} / {course.academicYear} / Grade {course.gradeLevel} / {formatCredits(course.credits)} planned credits{course.weighted ? " / Weighted" : ""}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {editable && <Link href={`/courses/${course.id}/assignments/new`} className="button-primary">Add assignment</Link>}
          {profile.role === "parent" && <Link href={`/courses/${course.id}/edit`} className="button-secondary">{course.completed ? "Edit or reopen course" : "Edit course"}</Link>}
          <Link href="/gradebook" className="button-secondary">View gradebook</Link>
        </div>
      </div>
      <section aria-label="Course grade" className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card p-6">
        <div><p className="text-sm text-muted">Current approved grade</p><p className="mt-2 text-3xl font-semibold text-accent">{grade ? `${grade.letter} / ${formatPercentage(grade.percentage)}` : "No grades yet"}</p></div>
        <div className="text-sm leading-7 text-muted"><p>{grade?.gradedCount ?? 0} / {course.assignments.length} assignments graded</p><p>{course.completed ? "Complete" : "In progress"}{course.gradeLevel < 9 ? " / Not included in high-school GPA" : ""}</p></div>
      </section>
      {course.completed && <p className="rounded-xl border border-border p-5 text-sm leading-6 text-muted">This course is complete. A parent must reopen it before changing assignments or grades.{grade?.letter === "F" ? " A failing course earns no credits." : ""}</p>}
      <section aria-labelledby="assignments-heading">
        <h2 id="assignments-heading" className="mb-5 text-xl font-semibold">Assignments</h2>
        <div className="space-y-4">
          {course.assignments.map((assignment) => {
            const approved = latestApproved(assignment.submissions);
            const submission = assignment.submissions.find((item) => item.id === approved?.id);
            return (
              <article key={`${assignment.id}:${assignment.version}`} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold">{assignment.title}</h3>
                    <p className="mt-2 text-xs leading-6 text-muted">{CATEGORY_LABELS[assignment.category]} / {assignment.maxPoints} possible points / {assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}` : "No due date"}</p>
                  </div>
                  <div className="text-sm">
                    <p className={submission ? "font-semibold text-accent" : "text-muted"}>{submission ? `${submission.letterGrade} / ${submission.earnedPoints} points` : "No grades yet"}</p>
                    {submission && <p className="mt-1 text-xs text-muted">Parent approved</p>}
                  </div>
                </div>
                {assignment.description && <p className="mt-4 text-sm leading-7 break-words whitespace-pre-wrap text-muted">{assignment.description}</p>}
                {submission?.feedback && <p className="mt-4 border-t border-border pt-4 text-sm leading-7 break-words whitespace-pre-wrap">{submission.feedback}</p>}
                {editable && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-x-5">
                      <Link href={`/assignments/${assignment.id}/edit`} className="text-link" aria-label={`Edit ${assignment.title}`}>Edit assignment</Link>
                      <Link href={`/assignments/${assignment.id}/grade`} className="text-link" aria-label={`Grade a photo for ${assignment.title}`}>Grade a photo</Link>
                    </div>
                    <details className="mt-2">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-accent">{submission ? "Revise manual grade" : "Enter manual grade"}</summary>
                      <ManualGradeForm assignment={{ id: assignment.id, version: assignment.version, maxPoints: assignment.maxPoints, lastApprovedId: submission?.id ?? "", earnedPoints: submission?.earnedPoints ?? null, feedback: submission?.feedback ?? "" }} />
                    </details>
                  </div>
                )}
              </article>
            );
          })}
          {!course.assignments.length && <p className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted">No assignments yet.{editable ? " Add an assignment to start this course's gradebook." : " Assignments will appear here once a parent adds them."}</p>}
        </div>
      </section>
    </div>
  );
}
