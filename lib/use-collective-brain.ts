"use client";

import { useCallback, useEffect, useState } from "react";
import type { Fact } from "@hiperbrain/core";
import { getBrowserClient } from "@/lib/supabase-browser";
import type { TracePayload } from "@/components/brain/brain-canvas";

export type TimedFact = Fact & { ts?: number };

export interface BrainStats {
  facts: number;
  concepts: number;
  relations: number;
}

export interface QueryMatch {
  name: string;
  score: number;
}

/** Normalised result of a recall query, as returned by `POST /api/brain/query`. */
export interface QueryResult {
  kind: "ask" | "analogy" | "neighbors";
  confident?: boolean;
  answer?: string | null;
  /** For ask: the canonical relation used. For analogy: the deduced relation. */
  relation?: string | null;
  score?: number;
  sigma?: number;
  others?: QueryMatch[];
  /** Neighbours query only. */
  entity?: string;
  neighbors?: QueryMatch[];
  trace?: TracePayload | null;
}

/** A parsed ask/analogy/neighbors command sent to the server for recall. */
export type BrainQuery =
  | { kind: "ask"; subject: string; relation: string }
  | { kind: "analogy"; value: string; from: string; to: string }
  | { kind: "neighbors"; entity: string };

export interface TeachOutcome {
  ok: boolean;
  status: "added" | "replaced" | "duplicate" | "superseded" | "disputed" | "error";
  message: string;
}

type LoadStatus = "loading" | "ready" | "error";

const SAMPLE_CAP = 2500;

function keyOf(f: Fact): string {
  return `${f.subject.toLowerCase()}|${f.relation.toLowerCase()}|${f.object.toLowerCase()}`;
}

/**
 * Connects the UI to the *server-side* collective brain.
 *
 * The brain is far too large to ship to every browser and rebuild there (it
 * holds hundreds of thousands of facts), so recall runs on the server and the
 * client only:
 *   - loads small live counters (`stats`) and a bounded sample of facts for the
 *     3D visualisation,
 *   - sends queries to `/api/brain/query` and renders the answers,
 *   - teaches new facts via `/api/brain`.
 * A Supabase realtime subscription keeps the counters and the sample live.
 */
export function useCollectiveBrain() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [stats, setStats] = useState<BrainStats>({ facts: 0, concepts: 0, relations: 0 });
  const [capacity, setCapacity] = useState(500000);
  const [sampleFacts, setSampleFacts] = useState<TimedFact[]>([]);

  // Initial load: counters + a small visualisation sample (no full fact dump).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, sampleRes] = await Promise.all([
          fetch("/api/brain/stats"),
          fetch("/api/brain/sample"),
        ]);
        if (!statsRes.ok) throw new Error("stats failed");
        const s = (await statsRes.json()) as BrainStats & { capacity: number };
        const sample = sampleRes.ok ? ((await sampleRes.json()) as { facts: TimedFact[] }) : { facts: [] };
        if (cancelled) return;
        setStats({ facts: s.facts, concepts: s.concepts, relations: s.relations });
        setCapacity(s.capacity ?? 500000);
        setSampleFacts(sample.facts ?? []);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live updates: bump the counter and feed new nodes to the canvas. Recall
  // itself stays on the server, so we only track the lightweight surface here.
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;

    type Row = Fact & { created_at?: string; status?: string | null };
    const isActive = (row: Row) => row.status == null || row.status === "active";
    const addSample = (fact: TimedFact) => {
      setSampleFacts((prev) => {
        const k = keyOf(fact);
        if (prev.some((f) => keyOf(f) === k)) return prev;
        const next = [...prev, fact];
        return next.length > SAMPLE_CAP ? next.slice(next.length - SAMPLE_CAP) : next;
      });
    };

    const channel = supabase
      .channel("facts-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "facts" },
        (payload) => {
          const row = payload.new as Row;
          if (!isActive(row)) return;
          setStats((s) => ({ ...s, facts: s.facts + 1 }));
          addSample({ subject: row.subject, relation: row.relation, object: row.object, ts: Date.now() });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  /** Ask the server-side brain a question. Returns null on network error. */
  const query = useCallback(async (q: BrainQuery): Promise<QueryResult | null> => {
    try {
      const res = await fetch("/api/brain/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
      if (!res.ok) return null;
      return (await res.json()) as QueryResult;
    } catch {
      return null;
    }
  }, []);

  const teach = useCallback(async (fact: Fact): Promise<TeachOutcome> => {
    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fact),
      });
      const data = await res.json();

      if (!res.ok) {
        return { ok: false, status: "error", message: data.error ?? "Something went wrong." };
      }

      const reason = typeof data.reason === "string" ? data.reason : "";
      switch (data.status) {
        case "duplicate":
          return { ok: true, status: "duplicate", message: "The brain already knew that." };
        case "superseded":
          return {
            ok: true,
            status: "superseded",
            message: `The brain kept its current answer.${reason ? ` ${reason}` : ""}`,
          };
        case "disputed":
          return {
            ok: true,
            status: "disputed",
            message: `Saved for review - the brain won't trust it until it's confirmed.${reason ? ` ${reason}` : ""}`,
          };
        case "replaced":
          return {
            ok: true,
            status: "replaced",
            message: `The brain changed its mind.${reason ? ` ${reason}` : ""}`,
          };
        default:
          setStats((s) => ({ ...s, facts: s.facts + 1 }));
          setSampleFacts((prev) => {
            const f = data.fact as Fact;
            const k = keyOf(f);
            if (prev.some((p) => keyOf(p) === k)) return prev;
            const next = [...prev, { ...f, ts: Date.now() }];
            return next.length > SAMPLE_CAP ? next.slice(next.length - SAMPLE_CAP) : next;
          });
          return { ok: true, status: "added", message: "Learned. The brain just grew." };
      }
    } catch {
      return { ok: false, status: "error", message: "Network error. Please try again." };
    }
  }, []);

  return { status, stats, capacity, sampleFacts, teach, query };
}
