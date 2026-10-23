import { formatCredits, formatGpa, studentSummary } from "@/lib/grades";

export function GradeSummary({ summary }: { summary: ReturnType<typeof studentSummary> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Unweighted GPA", formatGpa(summary.unweightedGpa), "4.00 scale / approved grades"],
        ["Weighted GPA", formatGpa(summary.weightedGpa), "5.00 scale / +1 for weighted passes"],
        ["Earned credits", formatCredits(summary.earnedCredits), "Completed, passing high-school courses"],
        ["Planned HS credits", formatCredits(summary.plannedCredits), "All high-school courses in this view"],
      ].map(([label, number, caption]) => (
        <div key={label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-accent">{number}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{caption}</p>
        </div>
      ))}
    </div>
  );
}
