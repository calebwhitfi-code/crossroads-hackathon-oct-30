import Link from "next/link";
import { visibleStudents } from "@/lib/gradebook";
import { courseGrade, formatGpa, studentSummary } from "@/lib/grades";

export default async function OverviewPage() {
  const { profile, students } = await visibleStudents();
  const courseCount = students.reduce((total, student) => total + student.courses.length, 0);

  return (
    <div className="space-y-9">
      <section className="max-w-2xl">
        <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Room to learn</p>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {profile.student ? `Your learning starts here, ${profile.student.firstName}.` : <>A little less paperwork.<br />A lot more learning.</>}
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-muted sm:text-base">
          {profile.student
            ? "Your courses, assignments, parent-approved grades, and feedback, all in one place."
            : "One thoughtful space for your homeschool. Manage your family's courses, approve grades, and follow each learner's progress."}
        </p>
      </section>

      {profile.student && (
        <section className="rounded-xl border border-border bg-card p-6" aria-labelledby="student-work-heading">
          <h2 id="student-work-heading" className="text-xl font-semibold">Your work and feedback</h2>
          <p className="mt-3 text-sm leading-7 text-muted">Read assignment instructions, check approved scores, and see your parent&apos;s feedback.</p>
          <Link href="/work" className="text-link mt-3">Open student work <span aria-hidden="true">&rarr;</span></Link>
        </section>
      )}

      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-3">
        {[
          [profile.student ? "Your profile" : "Students", profile.student ? "01" : String(students.length).padStart(2, "0"), profile.student ? `Grade ${profile.student.gradeLevel}` : "Learning at their own pace"],
          ["Courses", String(courseCount).padStart(2, "0"), "Across your learning space"],
          ["Graded courses", String(students.flatMap((student) => student.courses).filter((course) => courseGrade(course)).length).padStart(2, "0"), "Across all school years"],
        ].map(([label, value, caption]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted">{caption}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="students-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="students-heading" className="text-xl font-semibold tracking-tight">{profile.student ? "Your learning space" : "Meet your learners"}</h2>
            <p className="mt-1 text-sm text-muted">Every path looks a little different.</p>
          </div>
          <Link href="/courses" className="shrink-0 rounded-lg py-2 text-sm font-medium text-accent hover:text-accent-hover">View courses <span aria-hidden="true">&rarr;</span></Link>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {students.map((student) => {
            const summary = studentSummary(student.courses);
            return (
            <article key={student.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-raised text-sm font-semibold">{student.firstName[0]}{student.lastName[0]}</div>
                <div>
                  <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
                  <p className="mt-1 text-sm text-muted">Grade {student.gradeLevel} <span className="mx-1">/</span> Class of {student.graduationYear}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted">All school years</span>
                <span>{student.courses.length} courses</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted">{[...new Set(student.courses.map((course) => course.subject))].join(" / ")}</p>
              <p className="mt-3 text-xs leading-6 text-muted">Unweighted GPA <span className="text-accent">{formatGpa(summary.unweightedGpa)}</span> / Weighted GPA <span className="text-accent">{formatGpa(summary.weightedGpa)}</span></p>
            </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-7" aria-labelledby="foundation-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="foundation-heading" className="text-lg font-semibold">Less calculating. More clarity.</h2>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-accent">Phase 6</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Your gradebook connects approved grades with GPA and earned credits, by school year and cumulatively. Photo grading with parent approval, printable transcripts, and a read-only student work and feedback page are built in.</p>
        <Link href="/gradebook" className="text-link mt-3">Open gradebook <span aria-hidden="true" className="ml-2">&rarr;</span></Link>
        <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted">You stay in control: Suggested grades always need a parent&apos;s approval before entering the gradebook.</p>
      </section>
    </div>
  );
}
