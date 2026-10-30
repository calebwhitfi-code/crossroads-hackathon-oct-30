import Link from "next/link";
import { SaveNotice } from "@/components/save-notice";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";
import { GradingProviderNotice } from "@/components/grading-provider-notice";

export const metadata = { title: "Grade reviews" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Only a parent can review and approve grades.</h1></div>;
  }
  const pending = await db.submission.findMany({
    where: { status: "pending_review", source: "vision", assignment: { course: { student: { familyId: profile.family.id } } } },
    orderBy: { createdAt: "desc" },
    include: { assignment: { include: { course: { include: { student: true } } } } },
  });
  return (
    <div className="space-y-7">
      <SaveNotice saved={(await searchParams).saved} />
      <div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Parent approval</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Grades to review.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Suggested grades do not count until you approve them.</p></div>
      <div className="space-y-4">
        {pending.map((submission) => (
          <article key={submission.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold">{submission.assignment.title}</h2>
              <p className="mt-1 text-xs text-muted">{submission.assignment.course.student.firstName} / {submission.assignment.course.name} / Suggested {submission.suggestedGrade} of {submission.assignment.maxPoints}</p>
              {submission.gradingProvider && <GradingProviderNotice provider={submission.gradingProvider} notice={submission.gradingNotice} />}
            </div>
            <Link href={`/reviews/${submission.id}`} className="button-primary">Review</Link>
          </article>
        ))}
        {!pending.length && <p className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted">Nothing is waiting for review.</p>}
      </div>
    </div>
  );
}
