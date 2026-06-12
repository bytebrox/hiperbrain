"use client";

import { useMemo, useState } from "react";
import { Brain } from "@hiperbrain/core";

const SEQUENCES: Record<string, string[]> = {
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  planets: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  notes: ["Do", "Re", "Mi", "Fa", "Sol", "La", "Ti"],
};

/**
 * Sequence memory. A whole ordered list is stored in ONE vector by permuting
 * each element by its position before bundling; a transition memory predicts
 * what comes next. Both are pure algebra over the same 10,000 dimensions.
 */
export function SequenceDemo() {
  const [key, setKey] = useState<keyof typeof SEQUENCES>("weekdays");
  const items = SEQUENCES[key];

  const { brain, transitions } = useMemo(() => {
    const b = new Brain();
    return { brain: b, transitions: b.encodeTransitions(items) };
  }, [items]);

  const [current, setCurrent] = useState(items[0]);
  const next = useMemo(
    () => brain.predictNext(transitions, current, 1)[0],
    [brain, transitions, current],
  );

  // Reconstruct the whole list from the single position-encoded vector.
  const replay = useMemo(() => {
    const seq = brain.encodeSequence(items);
    return brain.replaySequence(seq, items.length);
  }, [brain, items]);

  return (
    <div className="rounded-sm border border-border bg-surface/40 p-5">
      <div className="flex flex-wrap gap-2">
        {Object.keys(SEQUENCES).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKey(k as keyof typeof SEQUENCES);
              setCurrent(SEQUENCES[k as keyof typeof SEQUENCES][0]);
            }}
            className={`rounded-sm border px-2.5 py-1 font-mono text-xs uppercase tracking-wider transition-colors ${
              key === k
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="mt-5 text-xs uppercase tracking-wider text-muted">
        pick an item - the brain predicts the next
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <button
            key={it}
            type="button"
            onClick={() => setCurrent(it)}
            className={`rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors ${
              current === it
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {it}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 font-mono text-sm">
        <span className="rounded-sm border border-border px-2.5 py-1 text-foreground">{current}</span>
        <span className="text-muted">predict next →</span>
        <span className="rounded-sm border border-accent/50 bg-accent/10 px-2.5 py-1 text-accent">
          {next?.name ?? "?"}
        </span>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="text-xs uppercase tracking-wider text-muted">
          the whole list, replayed from one vector
        </div>
        <div className="mt-2 font-mono text-xs text-muted/80">{replay.join(" → ")}</div>
      </div>
    </div>
  );
}
