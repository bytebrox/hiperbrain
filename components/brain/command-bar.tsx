"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { parseCommand } from "@/lib/parse-command";
import type {
  BrainQuery,
  QueryResult,
  TeachOutcome,
} from "@/lib/use-collective-brain";
import type { TracePayload } from "./brain-canvas";
import {
  type Example,
  type ExampleKind,
  EXAMPLES,
  KIND_HINT,
  KIND_LABEL,
  pickExamples,
  templateFor,
} from "@/lib/examples";

interface CommandBarProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Ask the server-side brain. Returns null on network error. */
  query: (q: BrainQuery) => Promise<QueryResult | null>;
  onTeach: (fact: { subject: string; relation: string; object: string }) => Promise<TeachOutcome>;
  /** Fires when a query resolves confidently, so the graph can visualise it. */
  onTrace?: (payload: TracePayload) => void;
}

const MODES: ExampleKind[] = ["ask", "teach", "reason"];

// Phrases the placeholder types out when the field is empty and unfocused.
const TYPE_PHRASES = [
  "capital of France",
  "What is the currency of Japan?",
  "Madrid is the capital of Spain",
  "USA is to Dollar as Mexico is to ?",
  "opposite of hot",
  "the author of Hamlet is Shakespeare",
];

function kindOf(cmdKind: ReturnType<typeof parseCommand>["kind"]): ExampleKind | null {
  if (cmdKind === "ask") return "ask";
  if (cmdKind === "teach") return "teach";
  if (cmdKind === "analogy" || cmdKind === "neighbors") return "reason";
  return null;
}

/** Turn a parsed command into the query payload the server understands. */
function toQuery(cmd: ReturnType<typeof parseCommand>): BrainQuery | null {
  if (cmd.kind === "ask") return { kind: "ask", subject: cmd.subject, relation: cmd.relation };
  if (cmd.kind === "analogy")
    return { kind: "analogy", value: cmd.value, from: cmd.from, to: cmd.to };
  if (cmd.kind === "neighbors") return { kind: "neighbors", entity: cmd.entity };
  return null;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export function CommandBar({ value, onValueChange, query, onTeach, onTrace }: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [taught, setTaught] = useState<TeachOutcome | null>(null);
  // The input value that produced the current `taught` message, so any change -
  // typing OR clicking a chip - automatically dismisses it.
  const [taughtForValue, setTaughtForValue] = useState<string | null>(null);

  // The latest recall result and the exact input it was computed for, so a stale
  // in-flight answer never renders against a newer query.
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultFor, setResultFor] = useState<string>("");
  const [querying, setQuerying] = useState(false);

  const [focused, setFocused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = useState("");
  // Start stable for SSR, then shuffle on the client to avoid hydration drift.
  const [chips, setChips] = useState<Example[]>(() => EXAMPLES.slice(0, 6));

  const cmd = parseCommand(value);
  const currentKind = kindOf(cmd.kind);
  const showTaught = taught && value === taughtForValue ? taught : null;
  const showResult = result && resultFor === value ? result : null;
  const placeholderActive = !reduced && !focused && value === "";

  // Shuffle the example chips once on mount (deferred so it is not a synchronous
  // setState inside the effect body, and to keep SSR output stable).
  useEffect(() => {
    const id = requestAnimationFrame(() => setChips(pickExamples(6)));
    return () => cancelAnimationFrame(id);
  }, []);

  // Resolve the query on the server (debounced). For teach/empty/invalid there
  // is nothing to recall, so we clear any previous answer. When a confident
  // result arrives, hand its trace to the graph so it can light up the path.
  useEffect(() => {
    const c = parseCommand(value);
    const q = toQuery(c);
    if (!q) {
      setResult(null);
      setResultFor(value);
      setQuerying(false);
      return;
    }
    let cancelled = false;
    setQuerying(true);
    const id = window.setTimeout(async () => {
      const r = await query(q);
      if (cancelled) return;
      setResult(r);
      setResultFor(value);
      setQuerying(false);
      if (r?.trace && onTrace) onTrace(r.trace);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [value, query, onTrace]);

  // Typewriter placeholder. When inactive we simply stop; `typed` is ignored by
  // the placeholder unless active, so there is no need to reset it here.
  useEffect(() => {
    if (!placeholderActive) return;
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = TYPE_PHRASES[phrase % TYPE_PHRASES.length];
      if (!deleting) {
        char += 1;
        setTyped(current.slice(0, char));
        if (char >= current.length) {
          deleting = true;
          timer = setTimeout(tick, 1700);
          return;
        }
        timer = setTimeout(tick, 55);
      } else {
        char -= 1;
        setTyped(current.slice(0, Math.max(0, char)));
        if (char <= 0) {
          deleting = false;
          phrase += 1;
          timer = setTimeout(tick, 400);
          return;
        }
        timer = setTimeout(tick, 28);
      }
    };
    timer = setTimeout(tick, 350);
    return () => clearTimeout(timer);
  }, [placeholderActive]);

  function focusInput() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function fillTemplate(kind: ExampleKind) {
    onValueChange(templateFor(kind));
    focusInput();
  }

  function pick(text: string) {
    onValueChange(text);
    focusInput();
  }

  async function onSubmit() {
    if (cmd.kind === "teach") {
      setPending(true);
      const outcome = await onTeach(cmd);
      setPending(false);
      setTaught(outcome);
      if (outcome.status === "added" || outcome.status === "replaced") {
        setTaughtForValue("");
        onValueChange("");
      } else {
        setTaughtForValue(value);
      }
    }
  }

  const placeholder = placeholderActive ? `${typed}\u258b` : "Ask, teach, or reason…";

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-center gap-2">
        {MODES.map((k) => {
          const active = currentKind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => fillTemplate(k)}
              title={KIND_HINT[k]}
              className={`btn-print rounded-sm border px-4 py-1.5 font-mono text-xs uppercase tracking-wider ${
                active
                  ? "border-accent/60 bg-accent/10 text-foreground"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setTaught(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          autoFocus
          spellCheck={false}
          placeholder={placeholder}
          aria-label="Ask or teach the brain"
          className="card-print w-full px-12 py-3.5 text-center text-base text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent sm:px-14 sm:py-4 sm:text-lg"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || value.trim() === ""}
          aria-label="Send"
          title="Send (or press Enter)"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm border border-border text-muted transition-colors hover:border-accent/60 hover:text-foreground disabled:opacity-30 disabled:hover:border-border disabled:hover:text-muted sm:right-2.5 sm:h-10 sm:w-10"
        >
          {pending ? (
            <Spinner className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          ) : (
            <SendIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          )}
        </button>
      </div>

      {/* Fixed height so switching between states (empty hint, answer, teach
          confirmation, neighbour list, ...) never changes the column height -
          otherwise the flex-1 canvas above would resize and the brain would
          visibly jump. Tall enough to hold the tallest state (the empty hint /
          neighbour list) without clipping. */}
      <div className="mt-4 flex h-44 items-center justify-center overflow-hidden sm:mt-6">
        <div className="w-full">
          <Result
            cmd={cmd}
            result={showResult}
            querying={querying}
            pending={pending}
            taught={showTaught}
            onPick={pick}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {chips.map((ex) => (
          <button
            key={ex.text}
            type="button"
            onClick={() => pick(ex.text)}
            className="btn-print group rounded-sm border border-border px-3 py-1 font-mono text-xs text-muted hover:border-accent/50 hover:text-foreground"
          >
            <span className="mr-1.5 text-[10px] uppercase tracking-wide text-accent/70">
              {KIND_LABEL[ex.kind]}
            </span>
            {ex.text}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setChips(pickExamples(6))}
          title="Show different examples"
          aria-label="Show different examples"
          className="rounded-sm border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
        >
          &#x21bb;
        </button>
      </div>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ""}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} opacity={0.2} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

/** Three dots that fade in sequence, to signal ongoing work. */
function AnimatedDots() {
  return (
    <span className="inline-flex">
      <span className="animate-pulse [animation-delay:0ms]">.</span>
      <span className="animate-pulse [animation-delay:200ms]">.</span>
      <span className="animate-pulse [animation-delay:400ms]">.</span>
    </span>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h13" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/** A small calibrated-confidence pill driven by the recall's noise-sigma. */
function ConfidencePill({ sigma, score }: { sigma: number; score: number }) {
  const level = sigma >= 8 ? "high" : sigma >= 4 ? "medium" : "low";
  const tone =
    level === "high"
      ? "border-positive/40 text-positive"
      : level === "medium"
        ? "border-accent/40 text-accent"
        : "border-border text-muted";
  return (
    <span
      title={`signal ≈ ${sigma.toFixed(1)}σ above chance`}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
    >
      {level} · {(score * 100).toFixed(0)}%
    </span>
  );
}

function Thinking() {
  return (
    <p className="text-center text-sm text-muted">
      Recalling<AnimatedDots />
    </p>
  );
}

function Result({
  cmd,
  result,
  querying,
  pending,
  taught,
  onPick,
}: {
  cmd: ReturnType<typeof parseCommand>;
  result: QueryResult | null;
  querying: boolean;
  pending: boolean;
  taught: TeachOutcome | null;
  onPick: (text: string) => void;
}) {
  if (taught) {
    const tone =
      taught.status === "error"
        ? "text-negative"
        : taught.status === "added" || taught.status === "replaced"
          ? "text-positive"
          : "text-muted";
    return <p className={`text-center text-sm ${tone}`}>{taught.message}</p>;
  }

  if (cmd.kind === "empty") {
    return <EmptyState onPick={onPick} />;
  }

  if (cmd.kind === "invalid") {
    return <p className="text-center text-sm text-muted">{cmd.message}</p>;
  }

  if (cmd.kind === "teach") {
    if (pending) {
      return (
        <div className="flex flex-col items-center gap-2 text-sm text-muted">
          <Spinner className="h-5 w-5 text-accent" />
          <span>
            Fact-checking and folding it into the brain<AnimatedDots />
          </span>
          <span className="text-xs text-muted/60">this can take a few seconds</span>
        </div>
      );
    }
    return (
      <p className="text-center text-sm text-muted">
        Press <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">Enter</kbd> to
        teach: the <span className="text-foreground">{cmd.relation}</span> of{" "}
        <span className="text-foreground">{cmd.subject}</span> is{" "}
        <span className="text-foreground">{cmd.object}</span>
      </p>
    );
  }

  // Recall is resolving on the server, or a stale result is being replaced.
  if (!result) {
    return querying ? <Thinking /> : <p className="text-center text-sm text-muted">&nbsp;</p>;
  }

  if (cmd.kind === "analogy") {
    if (!result.confident) {
      return (
        <p className="text-center text-sm text-muted">
          To reason by analogy, the brain needs to know both{" "}
          <span className="text-foreground">{cmd.from}</span> and{" "}
          <span className="text-foreground">{cmd.to}</span> well. Teach it a few facts about them
          first.
        </p>
      );
    }
    const others = result.others ?? [];
    return (
      <div className="text-center">
        <div className="text-3xl font-semibold tracking-tight text-accent">{result.answer}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
          <span>
            {cmd.from} is to {cmd.value} as {cmd.to} is to{" "}
            <span className="text-foreground">{result.answer}</span>
          </span>
          <ConfidencePill sigma={result.sigma ?? 0} score={result.score ?? 0} />
        </div>
        <div className="mt-2 text-xs text-muted/60">
          solved by vector algebra - no lookup
          {result.relation ? (
            <>
              {" · "}deduced relation: <span className="text-muted">{result.relation}</span>
            </>
          ) : null}
        </div>
        {others.length > 0 ? (
          <div className="mt-1 text-xs text-muted/70">
            also considered: {others.map((m) => m.name).join(", ")}
          </div>
        ) : null}
      </div>
    );
  }

  if (cmd.kind === "neighbors") {
    const entity = result.entity ?? cmd.entity;
    const neighbors = result.neighbors ?? [];
    if (neighbors.length === 0) {
      return (
        <p className="text-center text-sm text-muted">
          The brain needs to know a few facts about{" "}
          <span className="text-foreground">{cmd.entity}</span> before it can find related
          concepts.
        </p>
      );
    }
    return (
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider text-muted">concepts like</div>
        <div className="text-2xl font-semibold tracking-tight text-foreground">{entity}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {neighbors.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => onPick(`concepts like ${m.name}`)}
              title={`record similarity ${m.score.toFixed(2)}`}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {m.name}
              <span className="ml-1.5 opacity-50">{m.score.toFixed(2)}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted/60">
          nearest by holographic record - shared properties, no clustering step
        </div>
      </div>
    );
  }

  // Ask
  if (!result.confident) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted">
          The brain hasn&apos;t learned the {cmd.relation} of {cmd.subject} yet. Teach it:{" "}
          <span className="text-foreground">
            {cmd.relation} of {cmd.subject} is …
          </span>
        </p>
      </div>
    );
  }

  const others = result.others ?? [];
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-accent">{result.answer}</div>
      <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
        <span>
          the {cmd.relation} of {cmd.subject}
        </span>
        <ConfidencePill sigma={result.sigma ?? 0} score={result.score ?? 0} />
      </div>
      {others.length > 0 ? (
        <div className="mt-2 text-xs text-muted/70">
          also considered: {others.map((m) => m.name).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const rows: { kind: ExampleKind; example: string }[] = [
    { kind: "ask", example: "capital of France" },
    { kind: "teach", example: "Madrid is the capital of Spain" },
    { kind: "reason", example: "USA is to Dollar as Japan is to ?" },
  ];
  return (
    <div className="text-center">
      <p className="text-sm text-muted">
        Type in plain language - there are three things you can do:
      </p>
      <div className="mx-auto mt-3 flex max-w-xl flex-col gap-1.5">
        {rows.map((r) => (
          <button
            key={r.kind}
            type="button"
            onClick={() => onPick(r.example)}
            className="flex items-baseline gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-surface-2"
          >
            <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-accent">
              {KIND_LABEL[r.kind]}
            </span>
            <span className="text-muted">
              {KIND_HINT[r.kind]} -{" "}
              <span className="font-mono text-foreground">&quot;{r.example}&quot;</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
