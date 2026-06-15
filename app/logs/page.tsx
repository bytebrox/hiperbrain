"use client";

import { useEffect, useMemo, useState } from "react";
import { HypervectorHeatmap } from "@/components/heatmap";
import { useCollectiveBrain } from "@/lib/use-collective-brain";

const PAGE_SIZE = 50;

interface Dispute {
  subject: string;
  relation: string;
  losing: string;
  winning: string | null;
  status: "superseded" | "disputed";
  note: string | null;
  ts: number;
}

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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/disputes")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setDisputes(Array.isArray(d.disputes) ? d.disputes : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // All filtering and paging happens client-side - the facts are already loaded
  // for the brain/heatmap, so this adds zero extra server or database load.
  const filtered = useMemo(() => {
    const newestFirst = [...facts].reverse();
    const q = query.trim().toLowerCase();
    if (!q) return newestFirst;
    return newestFirst.filter(
      (f) =>
        f.subject.toLowerCase().includes(q) ||
        f.relation.toLowerCase().includes(q) ||
        f.object.toLowerCase().includes(q),
    );
  }, [facts, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const recent = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
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

      {disputes.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Conflicts the brain resolved
          </h2>
          <p className="mt-1 text-xs text-muted">
            When two people teach different answers to the same single-valued question, the
            fact-checker decides which one the brain keeps. Only the winner feeds recall.
          </p>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {disputes.map((d, i) => (
              <li key={`${d.subject}-${d.relation}-${d.losing}-${i}`} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
                  <span className="text-muted">the {d.relation} of</span>
                  <span>{d.subject}</span>
                  <span className="text-muted">:</span>
                  <span className="text-negative line-through decoration-negative/50">
                    {d.losing}
                  </span>
                  <span className="text-muted">&rarr;</span>
                  <span className="text-accent">{d.winning ?? "unresolved"}</span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      d.status === "disputed"
                        ? "border-border text-muted"
                        : "border-accent/40 text-accent"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                {d.note ? <p className="mt-1 text-xs text-muted/80">{d.note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {status === "loading" ? (
        <p className="mt-8 text-sm text-muted">Loading...</p>
      ) : status === "error" ? (
        <p className="mt-8 text-sm text-negative">Could not load the activity log.</p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              spellCheck={false}
              placeholder="search facts… (subject, relation or value)"
              aria-label="Search the activity log"
              className="w-full rounded-sm border border-border bg-surface/70 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent/60 sm:max-w-sm"
            />
            <span className="shrink-0 font-mono text-xs text-muted">
              {filtered.length.toLocaleString()} {query.trim() ? "matches" : "facts"}
            </span>
          </div>

          {recent.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No facts match “{query.trim()}”.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {recent.map((fact, i) => (
                <li
                  key={`${fact.subject}-${fact.relation}-${fact.object}-${safePage}-${i}`}
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

          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-4 font-mono text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded-sm border border-border px-3 py-1.5 uppercase tracking-wider text-muted transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-muted"
              >
                ← Prev
              </button>
              <span className="text-muted">
                Page <span className="text-foreground">{safePage + 1}</span> / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="rounded-sm border border-border px-3 py-1.5 uppercase tracking-wider text-muted transition-colors hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:text-muted"
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
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
