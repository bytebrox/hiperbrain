"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Fact, KnowledgeBrain } from "@/lib/hdc";
import { getBrowserClient } from "@/lib/supabase-browser";

export type TimedFact = Fact & { ts?: number };

interface BrainResponse {
  facts: TimedFact[];
  total: number;
  capacity: number;
}

export interface TeachOutcome {
  ok: boolean;
  status: "added" | "duplicate" | "error";
  message: string;
}

type LoadStatus = "loading" | "ready" | "error";

function keyOf(f: Fact): string {
  return `${f.subject.toLowerCase()}|${f.relation.toLowerCase()}|${f.object.toLowerCase()}`;
}

/**
 * Loads the shared facts, rebuilds the HDC brain locally, and keeps it live:
 * new facts taught by anyone arrive through a Supabase realtime subscription.
 * The heavy vector math runs entirely in the browser; the database only stores
 * and streams the small text facts.
 */
export function useCollectiveBrain() {
  const [facts, setFacts] = useState<TimedFact[]>([]);
  const [capacity, setCapacity] = useState(1000);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // De-duplicating append, shared by optimistic writes and realtime events.
  const addFact = useCallback((fact: TimedFact) => {
    setFacts((prev) => {
      const k = keyOf(fact);
      return prev.some((f) => keyOf(f) === k) ? prev : [...prev, fact];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/brain", { cache: "no-store" });
        if (!res.ok) throw new Error("Request failed");
        const data: BrainResponse = await res.json();
        if (cancelled) return;
        setFacts(data.facts);
        setCapacity(data.capacity);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to live fact inserts (no-op when Supabase is not configured).
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("facts-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "facts" },
        (payload) => {
          const row = payload.new as Fact & { created_at?: string };
          addFact({
            subject: row.subject,
            relation: row.relation,
            object: row.object,
            ts: row.created_at ? Date.parse(row.created_at) : Date.now(),
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [addFact]);

  const brain = useMemo(() => KnowledgeBrain.fromFacts(facts), [facts]);

  const teach = useCallback(
    async (fact: Fact): Promise<TeachOutcome> => {
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
        if (data.status === "duplicate") {
          return { ok: true, status: "duplicate", message: "The brain already knew that." };
        }
        addFact({ ...(data.fact as Fact), ts: Date.now() });
        return { ok: true, status: "added", message: "Learned. The brain just grew." };
      } catch {
        return { ok: false, status: "error", message: "Network error. Please try again." };
      }
    },
    [addFact],
  );

  return { facts, brain, status, capacity, teach };
}
