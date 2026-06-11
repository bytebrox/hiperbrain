"use client";

import { useMemo, useState } from "react";
import {
  cosineSimilarity,
  corrupt,
  DIMENSIONS,
  ItemMemory,
  seededHypervector,
} from "@hiperbrain/core";
import { HypervectorHeatmap } from "@/components/heatmap";

const CONCEPTS = [
  "France", "Japan", "Germany", "Brazil",
  "Apple", "Ocean", "Music", "Gravity",
  "Neuron", "Galaxy", "Coffee", "Mountain",
];

/**
 * Interactive demonstration of HDC's holographic fault tolerance: flip a chosen
 * fraction of a concept vector's 10,000 bits and watch the cleanup memory still
 * recover the right concept - the same graceful degradation seen in real brains.
 */
export function RobustnessDemo() {
  const [selected, setSelected] = useState(CONCEPTS[0]);
  const [percent, setPercent] = useState(30);

  const memory = useMemo(() => {
    const m = new ItemMemory();
    for (const name of CONCEPTS) m.add(name, seededHypervector(name, DIMENSIONS, 7));
    return m;
  }, []);

  const base = useMemo(() => seededHypervector(selected, DIMENSIONS, 7), [selected]);

  const { corrupted, matches, retained } = useMemo(() => {
    const ratio = percent / 100;
    const corrupted = corrupt(base, ratio);
    const matches = memory.nearest(corrupted, 3);
    const retained = cosineSimilarity(base, corrupted);
    return { corrupted, matches, retained };
  }, [base, percent, memory]);

  const top = matches[0];
  const correct = top?.name === selected;

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          concept{" "}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="ml-1 rounded-md border border-border bg-surface px-2 py-1 font-mono text-sm text-foreground outline-none focus:border-accent/60"
          >
            {CONCEPTS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 items-center gap-3 text-sm text-muted">
          damage
          <input
            type="range"
            min={0}
            max={49}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: "#22d3ee" }}
          />
          <span className="w-12 text-right font-mono text-foreground">{percent}%</span>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <Figure label="original">
          <HypervectorHeatmap vector={base} columns={100} cell={2} gap={0} className="block rounded" />
        </Figure>
        <Figure label={`corrupted - ${percent}% of bits flipped`}>
          <HypervectorHeatmap
            vector={corrupted}
            compareTo={base}
            columns={100}
            cell={2}
            gap={0}
            className="block rounded"
          />
        </Figure>

        <div className="min-w-[12rem] flex-1">
          <div className="text-xs uppercase tracking-wider text-muted">recovered concept</div>
          <div className={`mt-1 text-2xl font-semibold ${correct ? "text-accent" : "text-negative"}`}>
            {top?.name ?? "-"} {correct ? "OK" : "MISS"}
          </div>
          <div className="mt-2 space-y-1 font-mono text-xs text-muted">
            <div>similarity to original: {retained.toFixed(3)}</div>
            <div>
              cleanup score: {top ? top.score.toFixed(3) : "-"}
              {matches[1] ? `   (next: ${matches[1].name} ${matches[1].score.toFixed(3)})` : ""}
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted/70">
            Even with a third of its 10,000 dimensions destroyed, the vector still
            points unmistakably at the right concept. No single bit matters -
            meaning is smeared across all of them.
          </p>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-border bg-black/40 p-1">{children}</div>
      <figcaption className="mt-1 text-center font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </figcaption>
    </figure>
  );
}
