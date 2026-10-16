"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application shell could not load:", error); }, [error]);

  return (
    <html lang="en">
      <body className="bg-page px-6 py-12 font-sans text-ink">
        <main className="mx-auto max-w-xl">
          <h1 className="text-2xl font-semibold">Your workspace is unavailable.</h1>
          <p className="mt-3 text-sm leading-7 text-muted">Check that the local database is ready. On first setup, run <code>npm run db:setup</code>, then try again.</p>
          <button onClick={reset} className="mt-5 min-h-11 cursor-pointer rounded-xl bg-accent px-6 py-3 font-semibold text-page hover:bg-accent-hover">Try again</button>
        </main>
      </body>
    </html>
  );
}
