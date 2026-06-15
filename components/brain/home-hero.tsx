"use client";

import { useEffect, useRef, useState } from "react";
import { useCollectiveBrain } from "@/lib/use-collective-brain";
import { BrainCanvas, type BrainCanvasHandle } from "./brain-canvas";
import { BrainLoader } from "./brain-loader";
import { CommandBar } from "./command-bar";

export function HomeHero() {
  const { brain, facts, status, teach, ready, resolvers } = useCollectiveBrain();
  const [value, setValue] = useState("");
  const canvasRef = useRef<BrainCanvasHandle>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const commandAreaRef = useRef<HTMLDivElement>(null);
  const stats = brain.stats();
  const loading = status === "loading" || (status === "ready" && !ready);

  // Clicking a node fills the input; clicking anywhere outside the brain and the
  // command bar clears it again, so visitors are never stuck having to manually
  // delete a query they no longer want.
  useEffect(() => {
    const onDocDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (canvasAreaRef.current?.contains(target)) return;
      if (commandAreaRef.current?.contains(target)) return;
      setValue("");
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => document.removeEventListener("pointerdown", onDocDown);
  }, []);

  return (
    <div
      data-home-root
      className="flex min-h-0 flex-1 flex-col items-center px-4 py-6 lg:py-4"
    >
      <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col lg:justify-center">
        <div
          ref={canvasAreaRef}
          className="relative flex w-full flex-1 flex-col min-h-[160px] max-h-[34vh] lg:max-h-none lg:min-h-0"
        >
          <BrainCanvas
            ref={canvasRef}
            facts={facts}
            onNodeClick={(name) => setValue(`concepts like ${name}`)}
            className="h-full min-h-[160px] w-full flex-1 cursor-pointer lg:min-h-[160px]"
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

        <div className="mt-5 mb-5 shrink-0 text-center lg:mt-2 lg:mb-6">
          <h1 className="font-mono text-4xl font-bold lowercase tracking-tighter sm:text-5xl">
            hiperbrain
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-muted">
            a shared brain that thinks in 10,000 dimensions
          </p>
        </div>

        <div ref={commandAreaRef} className="shrink-0">
          <CommandBar
            value={value}
            onValueChange={setValue}
            brain={brain}
            resolvers={resolvers}
            onTeach={teach}
            onTrace={(payload) => canvasRef.current?.trace(payload)}
          />
        </div>

        <p className="mt-5 mb-1 shrink-0 text-center text-xs text-muted lg:mt-6 lg:mb-0">
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
