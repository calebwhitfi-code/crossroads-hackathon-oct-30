export function GradingProviderNotice({ provider, notice }: { provider: "mock" | "ai"; notice?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm leading-6">
      <p className="font-semibold text-accent">{provider === "ai" ? "AI grader / Anthropic" : "Mock grader / simulated results, not an AI assessment"}</p>
      {notice && <p role="status" className="mt-2 text-muted">{notice}</p>}
      <p className="mt-2 text-xs text-muted">Suggestions do not count toward grades or GPA until a parent approves.</p>
    </div>
  );
}
