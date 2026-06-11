import { ContractAddress } from "@/components/contract-address";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-background/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">hiperbrain</span>
          <span className="hidden sm:inline">· thinks in 10,000 dimensions</span>
        </div>

        <ContractAddress address={process.env.NEXT_PUBLIC_CONTRACT_ADDRESS} />

        <span className="text-xs text-muted/80">© {year} hiperbrain</span>
      </div>
    </footer>
  );
}
