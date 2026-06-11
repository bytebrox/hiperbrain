"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/logs", label: "Logs" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/30 blur-md" />
            <span className="relative h-3 w-3 rounded-full bg-accent shadow-[0_0_12px_2px_var(--color-accent)]" />
          </span>
          <span className="font-mono text-base font-semibold tracking-tight">
            haiperbrain
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <a
            href="https://github.com/bytebrox/hyperbrain"
            target="_blank"
            rel="noreferrer"
            className="ml-2 hidden rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground sm:inline-block"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
