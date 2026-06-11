"use client";

import { useState } from "react";
import { useCollectiveBrain } from "@/lib/use-collective-brain";
import { BrainCanvas } from "./brain-canvas";
import { BrainLoader } from "./brain-loader";
import { CommandBar } from "./command-bar";

export function HomeHero() {
  const { brain, facts, status, teach, ready } = useCollectiveBrain();
  const [value, setValue] = useState("");
  const stats = brain.stats();
  const loading = status === "loading" || (status === "ready" && !ready);

  return (
    <div
      data-home-root
      className="flex min-h-0 flex-1 flex-col items-center px-4 py-4"
    >
      <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-center">
        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          <BrainCanvas
            facts={facts}
            className="min-h-[160px] w-full flex-1 cursor-crosshair"
          />
          {loading ? (
            <BrainLoader
              label={
                status === "loading"
                  ? "connecting to the shared brain…"
                  : "assembling 10,000-dimensional memory…"
              }
            />
          ) : null}
        </div>

        <div className="mt-2 mb-6 shrink-0 text-center">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">hiperbrain</h1>
          <p className="mt-1 text-sm text-muted">
            a shared brain that thinks in 10,000 dimensions
          </p>
        </div>

        <div className="shrink-0">
          <CommandBar value={value} onValueChange={setValue} brain={brain} onTeach={teach} />
        </div>

        <p className="mt-6 shrink-0 text-center text-xs text-muted">
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
      </div>
    </div>
  );
}
