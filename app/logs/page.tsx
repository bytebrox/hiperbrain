"use client";

import { useMemo } from "react";
import { HypervectorHeatmap } from "@/components/heatmap";
import { useCollectiveBrain } from "@/lib/use-collective-brain";

function relativeTime(ts?: number): string {
  if (!ts) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LogsPage() {
  const { facts, brain, status } = useCollectiveBrain();
  const stats = brain.stats();
  const recent = useMemo(() => [...facts].reverse().slice(0, 200), [facts]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity log</h1>
          <p className="mt-1 text-sm text-muted">
            Everything the shared brain has been taught, newest first. Updates live.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="overflow-hidden rounded-lg border border-border bg-black/40 p-1 shadow-[0_0_30px_-12px_rgba(34,211,238,0.5)]">
            <HypervectorHeatmap
              vector={brain.thoughtVector()}
              columns={100}
              cell={2}
              gap={0}
              className="block rounded"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            thought fingerprint
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-6 border-y border-border py-4 font-mono text-sm">
        <Stat value={stats.facts} label="facts" />
        <Stat value={stats.concepts} label="concepts" />
        <Stat value={stats.relations} label="relations" />
      </div>

      {status === "loading" ? (
        <p className="mt-8 text-sm text-muted">Loading...</p>
      ) : status === "error" ? (
        <p className="mt-8 text-sm text-negative">Could not load the activity log.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {recent.map((fact, i) => (
            <li
              key={`${fact.subject}-${fact.relation}-${fact.object}-${i}`}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <span className="font-mono">
                <span className="text-muted">the</span> {fact.relation}{" "}
                <span className="text-muted">of</span> {fact.subject}{" "}
                <span className="text-muted">is</span>{" "}
                <span className="text-accent">{fact.object}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(fact.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <span className="text-accent">{value}</span> <span className="text-muted">{label}</span>
    </span>
  );
}
