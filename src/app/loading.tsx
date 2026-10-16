export default function Loading() {
  return (
    <div role="status" className="space-y-5 motion-safe:animate-pulse">
      <span className="sr-only">Loading your workspace...</span>
      <div className="h-9 w-2/3 rounded-xl bg-raised" />
      <div className="h-4 w-1/2 rounded-xl bg-raised" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-40 rounded-xl border border-border bg-card" />)}
      </div>
    </div>
  );
}
