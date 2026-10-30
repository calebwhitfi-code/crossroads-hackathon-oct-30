import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveForm, DiscardForm } from "@/components/grading-forms";
import { SaveNotice } from "@/components/save-notice";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";
import { GradingProviderNotice } from "@/components/grading-provider-notice";

export const metadata = { title: "Review suggested grade" };

export default async function ReviewPage({ params, searchParams }: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Only a parent can review and approve grades.</h1></div>;
  }
  const submission = await db.submission.findFirst({
    where: { id: (await params).submissionId, assignment: { course: { student: { familyId: profile.family.id } } } },
    include: { criteriaScores: { orderBy: { name: "asc" } }, assignment: { include: { course: { include: { student: true } } } } },
  });
  if (!submission) notFound();
  const { assignment } = submission;
  const pending = submission.status === "pending_review";
  const open = pending && !assignment.course.completed;
  return (
    <div className="max-w-3xl space-y-6">
      <SaveNotice saved={(await searchParams).saved} />
      {submission.gradingProvider && <GradingProviderNotice provider={submission.gradingProvider} notice={submission.gradingNotice} />}
      <div>
        <Link href="/reviews" className="text-link">Back to reviews</Link>
        <h1 className="mt-3 break-words text-3xl font-semibold">{assignment.title}</h1>
        <p className="mt-3 text-sm text-muted">{assignment.course.student.firstName} / {assignment.course.name} / {assignment.maxPoints} possible points</p>
      </div>
      <section aria-label="Suggested grade" className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted">{pending ? "Suggested (not yet counted)" : "Approved"}</p>
        <p className="mt-2 text-3xl font-semibold text-accent">{pending ? submission.suggestedGrade : submission.earnedPoints} / {assignment.maxPoints}</p>
        <ul className="mt-5 space-y-3 text-sm leading-6">
          {submission.criteriaScores.map((score) => (
            <li key={score.id} className="border-t border-border pt-3"><span className="font-semibold">{score.name}</span> <span className="text-accent">{score.earnedPoints} / {score.maxPoints}</span><p className="text-muted">{score.feedback}</p></li>
          ))}
        </ul>
      </section>
      {open && <ApproveForm submission={{ id: submission.id, maxPoints: assignment.maxPoints, suggested: Number(submission.suggestedGrade), feedback: submission.feedback }} />}
      {open && <DiscardForm id={submission.id} />}
      {pending && !open && <p className="rounded-xl border border-border p-5 text-sm leading-6 text-muted">Reopen this course before approving this grade.</p>}
      {!pending && <p className="rounded-xl border border-border p-5 text-sm leading-6 text-muted">This submission has been reviewed.</p>}
    </div>
  );
}
