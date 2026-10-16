"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Workspace could not load:", error); }, [error]);

  return (
    <div role="alert" className="rounded-xl border border-border bg-card p-7">
      <h1 className="text-2xl font-semibold">Your workspace couldn&apos;t load.</h1>
      <p className="mt-3 text-sm leading-7 text-muted">Please try again. If the problem continues, check the local database and run npm run db:setup.</p>
      <button onClick={reset} className="mt-5 min-h-11 cursor-pointer rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-page hover:bg-accent-hover">Try again</button>
    </div>
  );
}
