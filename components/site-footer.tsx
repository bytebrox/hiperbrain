import Link from "next/link";
import { ContractAddress } from "@/components/contract-address";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 bg-gradient-to-t from-background via-background/85 to-transparent">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">hiperbrain</span>
          <span className="hidden sm:inline">· thinks in 10,000 dimensions</span>
        </div>

        <ContractAddress address={process.env.NEXT_PUBLIC_TOKEN_MINT} />

        <div className="flex items-center gap-3 text-xs text-muted/80">
          <Link href="/admin" className="transition-colors hover:text-foreground">
            Admin
          </Link>
          <span>© {year} hiperbrain</span>
        </div>
      </div>
    </footer>
  );
}
