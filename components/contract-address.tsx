"use client";

import { useState } from "react";

function abbreviate(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ContractAddress({ address }: { address?: string }) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <span className="font-mono text-xs text-muted/60">contract address coming soon</span>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); fail silently.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy contract address: ${address}`}
      aria-label="Copy contract address"
      className="group flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
    >
      <span className="uppercase tracking-wide text-accent/70">CA</span>
      <span>{abbreviate(address)}</span>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 text-positive" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}
