import Link from "next/link";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";

export default async function OverviewPage() {
  const profile = await getProfileContext();
  const students = await db.student.findMany({
    where: { familyId: profile.family.id, ...(profile.student ? { id: profile.student.id } : {}) },
    orderBy: { firstName: "asc" },
    include: { courses: { select: { id: true, subject: true } } },
  });
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
            ? "Your courses, all in one place. This foundation preview shows your learning space; daily work and feedback arrive in Phase 5."
            : "One thoughtful space for your homeschool. Your family and courses are ready. A simpler way to manage grades is coming next."}
        </p>
      </section>

      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-3">
        {[
          [profile.student ? "Your profile" : "Students", profile.student ? "01" : String(students.length).padStart(2, "0"), profile.student ? `Grade ${profile.student.gradeLevel}` : "Learning at their own pace"],
          ["Courses", String(courseCount).padStart(2, "0"), "Across your learning space"],
          ["School year", "2026-27", "Seeded demo school year"],
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
          {students.map((student) => (
            <article key={student.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-raised text-sm font-semibold">{student.firstName[0]}{student.lastName[0]}</div>
                <div>
                  <h3 className="font-semibold">{student.firstName} {student.lastName}</h3>
                  <p className="mt-1 text-sm text-muted">Grade {student.gradeLevel} <span className="mx-1">/</span> Class of {student.graduationYear}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted">2026-2027 courses</span>
                <span>{student.courses.length} courses</span>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted">{[...new Set(student.courses.map((course) => course.subject))].join(" / ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 sm:p-7" aria-labelledby="foundation-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="foundation-heading" className="text-lg font-semibold">A strong foundation. A clear next step.</h2>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-accent">Phase 1</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Demo profiles, family records, and courses are connected. Next comes the gradebook, followed by photo grading and printable transcripts.</p>
        <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted">You stay in control: AI-suggested grades will always need a parent&apos;s approval before entering the gradebook.</p>
      </section>
    </div>
  );
}
