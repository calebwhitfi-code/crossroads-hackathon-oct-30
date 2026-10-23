"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", symbol: "overview" },
  { href: "/courses", label: "Courses", symbol: "courses" },
  { href: "/gradebook", label: "Gradebook", symbol: "courses" },
  { href: "/reviews", label: "Reviews", symbol: "overview" },
  { href: "/rubrics", label: "Rubrics", symbol: "courses" },
  { href: "/transcripts", label: "Transcripts", symbol: "overview" },
] as const;

function NavIcon({ kind }: { kind: "overview" | "courses" }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {kind === "overview"
        ? <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>
        : <><path d="M12 5v15M3 4.5c3-1 6-1 9 1 3-2 6-2 9-1V19c-3-1-6-1-9 1-3-2-6-2-9-1Z" /></>}
    </svg>
  );
}

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="grid grid-cols-3 sm:grid-cols-6 gap-2 lg:flex lg:flex-col">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`))
          || (link.href === "/courses" && pathname.startsWith("/assignments/"));
        return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-11 flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors lg:flex-row lg:gap-3 lg:px-4 lg:text-sm ${
            active
              ? "border-border bg-raised text-accent"
              : "border-transparent text-muted hover:bg-card hover:text-ink"
          }`}
        >
          <NavIcon kind={link.symbol} />
          {link.label}
        </Link>
        );
      })}
    </nav>
  );
}
