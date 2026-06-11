"use client";

import { useState } from "react";
import { useCollectiveBrain } from "@/lib/use-collective-brain";
import { BrainCanvas } from "./brain-canvas";
import { CommandBar } from "./command-bar";

const EXAMPLES = [
  "capital of Japan",
  "currency of France",
  "sound of Dog",
  "color of Sky",
];

export function HomeHero() {
  const { brain, facts, status, teach } = useCollectiveBrain();
  const [value, setValue] = useState("");
  const stats = brain.stats();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <BrainCanvas facts={facts} height={380} className="mb-2 w-full cursor-crosshair" />

        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">haiperbrain</h1>
          <p className="mt-1 text-sm text-muted">
            a shared brain that thinks in 10,000 dimensions
          </p>
        </div>

        <CommandBar value={value} onValueChange={setValue} brain={brain} onTeach={teach} />

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => setValue(example)}
              className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          {status === "ready" ? (
            <>
              {stats.facts.toLocaleString()} facts · {stats.concepts.toLocaleString()} concepts ·{" "}
              {stats.relations} relations
            </>
          ) : status === "error" ? (
            "offline - showing a local brain"
          ) : (
            "connecting to the shared brain..."
          )}
        </p>
        <p className="mt-2 text-center text-xs text-muted/60">
          type <span className="font-mono">relation of subject</span> to ask, or{" "}
          <span className="font-mono">relation of subject is object</span> to teach
        </p>
      </div>
    </div>
  );
}
