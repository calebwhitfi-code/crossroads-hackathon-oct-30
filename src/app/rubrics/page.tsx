import { RubricForm } from "@/components/grading-forms";
import { SaveNotice } from "@/components/save-notice";
import { db } from "@/lib/db";
import { getProfileContext } from "@/lib/profile";

export const metadata = { title: "Rubric templates" };

export default async function RubricsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const profile = await getProfileContext();
  if (profile.role !== "parent") {
    return <div><h1 className="text-2xl font-semibold">Rubrics are managed by parents.</h1></div>;
  }
  const rubrics = await db.rubric.findMany({
    where: { familyId: profile.family.id }, orderBy: { createdAt: "desc" }, include: { criteria: { orderBy: { position: "asc" } } },
  });
  return (
    <div className="space-y-8">
      <SaveNotice saved={(await searchParams).saved} />
      <div><p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">Reusable rubrics</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Rubric templates.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Create a rubric once, then choose it when grading any assignment photo. Rubrics are private to {profile.family.name}.</p></div>
      <section aria-labelledby="saved-rubrics" className="space-y-4">
        <h2 id="saved-rubrics" className="text-xl font-semibold">Saved rubrics</h2>
        {rubrics.map((rubric) => (
          <article key={rubric.id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-lg font-semibold">{rubric.name}</h3>
            <p className="mt-1 text-xs text-muted">{rubric.criteria.reduce((sum, item) => sum + item.maxPoints, 0)} total points</p>
            <ul className="mt-3 space-y-1 text-sm leading-6 text-muted">
              {rubric.criteria.map((criterion) => <li key={criterion.id}>{criterion.name} ({criterion.maxPoints}): {criterion.description}</li>)}
            </ul>
          </article>
        ))}
        {!rubrics.length && <p className="rounded-xl border border-border bg-card p-6 text-sm leading-7 text-muted">No rubrics yet. Create one below.</p>}
      </section>
      <section aria-labelledby="new-rubric" className="max-w-3xl space-y-4">
        <h2 id="new-rubric" className="text-xl font-semibold">New rubric</h2>
        <RubricForm />
      </section>
    </div>
  );
}
