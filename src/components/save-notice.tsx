const messages: Record<string, string> = {
  course: "Course saved.",
  assignment: "Assignment saved.",
  grade: "Grade approved and saved.",
  rubric: "Rubric saved.",
  suggested: "Suggested grade created. Review it below before approving.",
  approved: "Grade approved and saved.",
  discarded: "Suggestion discarded.",
  deleted: "Record and its associated grades deleted.",
};

export function SaveNotice({ saved }: { saved: string | string[] | undefined }) {
  const message = typeof saved === "string" ? messages[saved] : undefined;
  return message ? <p role="status" className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-accent">{message}</p> : null;
}
