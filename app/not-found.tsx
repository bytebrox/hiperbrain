import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - lost thought",
  robots: { index: false, follow: false },
};

const GRID = 7;

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {/* Halftone dot cluster, echoing the brain canvas's screen-print look. */}
      <div
        className="mb-8 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${GRID}, 0.5rem)` }}
        aria-hidden
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const row = Math.floor(i / GRID);
          const col = i % GRID;
          const edge = Math.max(Math.abs(row - 3), Math.abs(col - 3));
          return (
            <span
              key={i}
              className="halftone-dot h-2 w-2 rounded-full bg-accent"
              style={{
                animationDelay: `${(row + col) * 0.08}s`,
                opacity: Math.max(0.12, 1 - edge * 0.18),
              }}
            />
          );
        })}
      </div>

      <h1 className="font-mono text-6xl font-bold tracking-tighter sm:text-7xl">404</h1>
      <p className="mt-4 font-mono text-sm uppercase tracking-[0.28em] text-muted">
        this thought isn&apos;t in the brain
      </p>
      <p className="mt-3 max-w-md text-sm text-muted/80">
        The page you were looking for was never taught, or has been forgotten. Head back and ask
        the shared brain something it knows.
      </p>

      <Link
        href="/"
        className="btn-print mt-8 rounded-sm border border-accent/50 px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-foreground"
      >
        ← back to the brain
      </Link>
    </div>
  );
}
