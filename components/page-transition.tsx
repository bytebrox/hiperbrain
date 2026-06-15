"use client";

import { usePathname } from "next/navigation";

/**
 * Replays a soft enter animation on every route change. The `key` is the current
 * pathname, so React remounts the wrapper on navigation and the CSS animation
 * (see `.page-enter` in globals.css) fires fresh each time.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
