"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HypervectorHeatmap } from "@/components/heatmap";
import { getBrowserClient } from "@/lib/supabase-browser";

const PAGE_SIZE = 50;

interface LogFact {
  subject: string;
  relation: string;
  object: string;
  ts: number;
}

interface Dispute {
  subject: string;
  relation: string;
  losing: string;
  winning: string | null;
  status: "superseded" | "disputed";
  note: string | null;
  ts: number;
}

interface Stats {
  facts: number;
  concepts: number;
  relations: number;
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [thought, setThought] = useState<Int8Array | null>(null);
  const [facts, setFacts] = useState<LogFact[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  // Counters + thought fingerprint come from the server-side brain (no facts
  // shipped to the browser).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/brain/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStats({ facts: d.facts, concepts: d.concepts, relations: d.relations });
      })
      .catch(() => {});
    fetch("/api/brain/thought")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.vector)) setThought(Int8Array.from(d.vector));
      })
      .catch(() => {});
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

  // Search + paging run in the database; the client only ever holds one page.
  const reqId = useRef(0);
  const loadFacts = useCallback(async (q: string, p: number) => {
    const id = ++reqId.current;
    const params = new URLSearchParams({
      q,
      limit: String(PAGE_SIZE),
      offset: String(p * PAGE_SIZE),
    });
    try {
      const res = await fetch(`/api/facts?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { facts: LogFact[]; total: number };
      if (id !== reqId.current) return;
      setFacts(data.facts);
      setTotal(data.total);
      setStatus("ready");
    } catch {
      if (id === reqId.current) setStatus("error");
    }
  }, []);

  // Debounce search input; reset to the first page whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => void loadFacts(query.trim(), page), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [query, page, loadFacts]);

  // Live: when someone teaches a new fact, refresh the first unfiltered page and
  // bump the counter so the log keeps feeling alive.
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("logs-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "facts" },
        () => {
          setStats((s) => (s ? { ...s, facts: s.facts + 1 } : s));
          if (page === 0 && query.trim() === "") void loadFacts("", 0);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [page, query, loadFacts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

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
            {thought ? (
              <HypervectorHeatmap
                vector={thought}
                columns={100}
                cell={2}
                gap={0}
                className="block rounded"
              />
            ) : (
              <div className="h-[200px] w-[200px]" />
            )}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            thought fingerprint
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-6 border-y border-border py-4 font-mono text-sm">
        <Stat value={stats?.facts ?? 0} label="facts" />
        <Stat value={stats?.concepts ?? 0} label="concepts" />
        <Stat value={stats?.relations ?? 0} label="relations" />
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
              {total.toLocaleString()} {query.trim() ? "matches" : "facts"}
            </span>
          </div>

          {facts.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No facts match “{query.trim()}”.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {facts.map((fact, i) => (
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
      <span className="text-accent">{value.toLocaleString()}</span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}
