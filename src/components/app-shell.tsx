import Link from "next/link";
import { getProfileContext } from "@/lib/profile";
import { Navigation } from "@/components/navigation";
import { ProfileSwitcher } from "@/components/profile-switcher";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfileContext();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only z-50 rounded-xl bg-accent px-4 py-3 text-page focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
        Skip to content
      </a>
      <aside className="border-b border-border p-5 sm:p-7 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Link href="/" aria-label="Homestead home" className="mb-7 inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-accent">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
            </svg>
          </span>
          <span className="text-xl font-semibold tracking-tight">homestead<span className="text-accent">.</span></span>
        </Link>
        <Navigation />
        <div className="mt-8 hidden space-y-4 px-4 lg:block">
          <p className="text-xs font-semibold tracking-widest text-muted uppercase">Coming next</p>
          {["Photo grading", "Transcripts"].map((label, index) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm text-muted">
              <span>{label}</span>
              <span className="rounded-md border border-border px-2 py-1 text-[10px]">Phase {index + 3}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-5 lg:mt-auto lg:pt-6">
          <ProfileSwitcher
            active={profile.value}
            families={profile.families.map((family) => ({
              id: family.id, name: family.name,
              students: family.students.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
            }))}
          />
          <p className="mt-3 text-xs leading-relaxed text-muted">Demo profiles only. No sign-in or access control.</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-9 lg:px-12">
          <p className="text-sm text-muted">{profile.family.name}<span className="mx-3 text-border">/</span><span className="text-ink">{profile.student?.firstName ?? "Parent workspace"}</span></p>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted">
            {profile.role === "parent" ? "Parent view" : "Student view"} <span className="mx-1">/</span> Demo
          </span>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-8 outline-none sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          {children}
        </main>
        <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 py-6 text-xs text-muted sm:px-9 lg:px-12">
          <span>Made for learning. Built around your family.</span>
          <span>Gradebook demo / Phase 2</span>
        </footer>
      </div>
    </div>
  );
}
