import Link from "next/link";
import { visibleStudents } from "@/lib/gradebook";
import { CATEGORY_LABELS, latestApproved, letterGradeFor } from "@/lib/grades";

export const metadata = { title: "Student work" };

export default async function StudentWorkPage() {
  const { profile, students } = await visibleStudents();

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Work and feedback</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Student work</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
          {profile.role === "student" ? "Your assignments, approved scores, and parent feedback." : "Your family's assignments, approved scores, and parent feedback."}
          {" "}This page is read-only. Suggested grades stay private until a parent approves them.
        </p>
      </div>
      {students.map((student) => (
        <section key={student.id} aria-labelledby={`work-${student.id}`} className="space-y-5">
          <h2 id={`work-${student.id}`} className="text-xl font-semibold">{student.firstName} {student.lastName}</h2>
          {student.courses.map((course) => (
            <section key={course.id} aria-labelledby={`work-${course.id}`} className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <h3 id={`work-${course.id}`} className="break-words text-lg font-semibold">
                <Link href={`/courses/${course.id}`} className="text-link max-w-full"><span className="min-w-0 break-words">{course.name}</span></Link>
              </h3>
              <p className="mt-2 text-xs leading-6 text-muted">{course.academicYear} / {course.completed ? "Complete" : "In progress"}</p>
              <div className="mt-5 space-y-4">
                {course.assignments.map((assignment) => {
                  const approved = latestApproved(assignment.submissions);
                  const submission = assignment.submissions.find((item) => item.id === approved?.id);
                  return (
                    <article key={assignment.id} className="rounded-lg border border-border p-4">
                      <h4 className="break-words font-semibold">{assignment.title}</h4>
                      <p className="mt-2 text-xs leading-6 text-muted">
                        {CATEGORY_LABELS[assignment.category]} / {assignment.maxPoints} possible points / {assignment.dueAt ? `Due ${assignment.dueAt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}` : "No due date"}
                      </p>
                      {assignment.description && <p className="mt-3 text-sm leading-7 break-words whitespace-pre-wrap text-muted">{assignment.description}</p>}
                      <p className="mt-3 text-sm font-semibold text-accent">
                        {submission && submission.earnedPoints !== null ? `Parent-approved score: ${letterGradeFor(submission.earnedPoints / assignment.maxPoints * 100, course)} / ${submission.earnedPoints} points` : "No approved score yet"}
                      </p>
                      {submission && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="text-xs font-medium text-muted">Parent feedback</p>
                          <p className="mt-2 text-sm leading-7 break-words whitespace-pre-wrap">{submission.feedback || "No feedback provided yet."}</p>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!course.assignments.length && <p className="text-sm leading-7 text-muted">No assignments yet. Assignments will appear here once a parent adds them.</p>}
              </div>
            </section>
          ))}
          {!student.courses.length && <p className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted">No courses yet. A parent can add courses to start this learning space.</p>}
        </section>
      ))}
      {!students.length && <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted">No students in this family yet.</p>}
    </div>
  );
}
