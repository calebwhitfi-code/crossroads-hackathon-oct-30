import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-border bg-card p-7">
      <p className="text-sm text-accent">404</p>
      <h1 className="mt-3 text-2xl font-semibold">That page isn&apos;t part of your workspace.</h1>
      <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-page hover:bg-accent-hover">Back to overview</Link>
    </div>
  );
}
