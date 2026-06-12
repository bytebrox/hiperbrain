"use client";

import { useMemo, useState } from "react";
import { Brain } from "@hiperbrain/core";

// A few example sentences per language. The brain learns each class from these
// once - no training loop - then classifies anything you type by n-gram shape.
const TRAINING: Record<string, string[]> = {
  English: [
    "the quick brown fox jumps over the lazy dog",
    "this is a simple english sentence about the weather today",
    "she sells seashells by the seashore every summer morning",
  ],
  Spanish: [
    "el rapido zorro marron salta sobre el perro perezoso",
    "esta es una frase sencilla en espanol sobre el clima de hoy",
    "la vida es bella cuando el sol brilla sobre la ciudad",
  ],
  German: [
    "der schnelle braune fuchs springt ueber den faulen hund",
    "dies ist ein einfacher deutscher satz ueber das wetter heute",
    "das leben ist schoen wenn die sonne ueber der stadt scheint",
  ],
  French: [
    "le rapide renard brun saute par dessus le chien paresseux",
    "ceci est une phrase simple en francais sur le temps aujourd hui",
    "la vie est belle quand le soleil brille sur la ville",
  ],
};

const PRESETS = [
  "where is the nearest train station",
  "donde esta la estacion de tren mas cercana",
  "wo ist der naechste bahnhof",
  "ou est la gare la plus proche",
];

const BAR_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24"];

/**
 * One-shot language identification. The brain learns four languages from a
 * handful of sentences each, then labels new text by which class prototype its
 * character-n-gram fingerprint is closest to. No model download, no training.
 */
export function ClassifierDemo() {
  const brain = useMemo(() => {
    const b = new Brain();
    for (const [label, examples] of Object.entries(TRAINING)) b.learnClass(label, examples);
    return b;
  }, []);

  const [text, setText] = useState(PRESETS[0]);
  const result = useMemo(() => brain.classify(text, 4), [brain, text]);
  const top = result[0];

  // Map cosine scores into a 0..1 range for the bars (they cluster low/positive).
  const max = Math.max(0.0001, ...result.map((r) => r.score));

  return (
    <div className="rounded-sm border border-border bg-surface/40 p-5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="Type a sentence in any of the four languages…"
        className="w-full rounded-sm border border-border bg-surface px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-accent/60"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setText(p)}
            className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            {p.slice(0, 22)}…
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-muted">detected language</div>
        <div className="text-xl font-semibold text-accent">{top?.name ?? "-"}</div>
      </div>

      <div className="mt-3 space-y-2">
        {result.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right font-mono text-xs text-muted">{r.name}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.max(2, (r.score / max) * 100)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  opacity: i === 0 ? 1 : 0.5,
                }}
              />
            </div>
            <div className="w-12 shrink-0 font-mono text-xs text-muted">{r.score.toFixed(3)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted/70">
        Each language is a single prototype vector bundled from its examples.
        Classifying is one cosine comparison per class - the same trick scales to
        sentiment, topic or intent with your own labels.
      </p>
    </div>
  );
}
