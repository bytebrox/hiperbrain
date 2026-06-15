"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type KnowledgeBrain, recallConfidence } from "@hiperbrain/core";
import { parseCommand, type Command } from "@/lib/parse-command";
import { canonicalRelation } from "@/lib/relation-aliases";
import type { BrainResolvers, TeachOutcome } from "@/lib/use-collective-brain";
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
  brain: KnowledgeBrain;
  resolvers: BrainResolvers | null;
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

export function CommandBar({
  value,
  onValueChange,
  brain,
  resolvers,
  onTeach,
  onTrace,
}: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [taught, setTaught] = useState<TeachOutcome | null>(null);
  // The input value that produced the current `taught` message, so any change -
  // typing OR clicking a chip - automatically dismisses it.
  const [taughtForValue, setTaughtForValue] = useState<string | null>(null);

  const [focused, setFocused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [typed, setTyped] = useState("");
  // Start stable for SSR, then shuffle on the client to avoid hydration drift.
  const [chips, setChips] = useState<Example[]>(() => EXAMPLES.slice(0, 6));

  const cmd = parseCommand(value);
  const currentKind = kindOf(cmd.kind);
  const showTaught = taught && value === taughtForValue ? taught : null;
  const placeholderActive = !reduced && !focused && value === "";

  // Shuffle the example chips once on mount (deferred so it is not a synchronous
  // setState inside the effect body, and to keep SSR output stable).
  useEffect(() => {
    const id = requestAnimationFrame(() => setChips(pickExamples(6)));
    return () => cancelAnimationFrame(id);
  }, []);

  // When a query resolves to a confident answer, hand the graph the concepts it
  // reasoned over so it can light up the actual computation. Debounced so fast
  // typing doesn't thrash the animation.
  useEffect(() => {
    if (!onTrace) return;
    const id = window.setTimeout(() => {
      const payload = buildTrace(brain, resolvers, cmd);
      if (payload) onTrace(payload);
    }, 220);
    return () => window.clearTimeout(id);
    // `cmd` is derived from `value`; depending on `value` covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, brain, resolvers, onTrace]);

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
            brain={brain}
            resolvers={resolvers}
            cmd={cmd}
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
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
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

function Suggestion({ query, onPick }: { query: string; onPick: (text: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(query)}
      className="mt-2 rounded-sm border border-accent/40 px-2.5 py-1 font-mono text-xs text-accent transition-colors hover:bg-accent/10"
    >
      did you mean: {query}?
    </button>
  );
}

function Result({
  brain,
  resolvers,
  cmd,
  pending,
  taught,
  onPick,
}: {
  brain: KnowledgeBrain;
  resolvers: BrainResolvers | null;
  cmd: ReturnType<typeof parseCommand>;
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
        Press <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">Enter</kbd>{" "}
        to teach: the <span className="text-foreground">{cmd.relation}</span> of{" "}
        <span className="text-foreground">{cmd.subject}</span> is{" "}
        <span className="text-foreground">{cmd.object}</span>
      </p>
    );
  }

  if (cmd.kind === "analogy") {
    const matches = brain.analogy(cmd.value, cmd.from, cmd.to, 4);
    const conf = recallConfidence(matches);
    if (!conf.confident) {
      return (
        <p className="text-center text-sm text-muted">
          To reason by analogy, the brain needs to know both{" "}
          <span className="text-foreground">{cmd.from}</span> and{" "}
          <span className="text-foreground">{cmd.to}</span> well. Teach it a few facts
          about them first.
        </p>
      );
    }
    // The relation the brain deduced purely from algebra, to make it explainable.
    const recovered = brain.recoverRelation(cmd.value, cmd.from, 1)[0];
    const others = matches.slice(1).filter((m) => m.score > 0.05);
    return (
      <div className="text-center">
        <div className="text-3xl font-semibold tracking-tight text-accent">{matches[0].name}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
          <span>
            {cmd.from} is to {cmd.value} as {cmd.to} is to{" "}
            <span className="text-foreground">{matches[0].name}</span>
          </span>
          <ConfidencePill sigma={conf.sigma} score={conf.score} />
        </div>
        <div className="mt-2 text-xs text-muted/60">
          solved by vector algebra - no lookup
          {recovered ? (
            <>
              {" · "}deduced relation:{" "}
              <span className="text-muted">{recovered.name}</span>
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
    const entity =
      resolvers?.concept.resolve(cmd.entity)?.name ?? cmd.entity;
    const neighbors = brain.similarConcepts(entity, 6).filter((m) => m.score > 0.05);
    if (neighbors.length === 0) {
      return (
        <p className="text-center text-sm text-muted">
          The brain needs to know a few facts about{" "}
          <span className="text-foreground">{cmd.entity}</span> before it can find
          related concepts.
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
  const relation = canonicalRelation(cmd.relation);
  const matches = brain.ask(cmd.subject, relation, 4);
  const conf = recallConfidence(matches);
  if (!conf.confident) {
    // Fall back to typo-tolerant resolution: maybe the subject or relation is
    // just misspelled. Only suggest a correction that actually has an answer.
    const suggestion = suggestCorrection(brain, resolvers, cmd.subject, cmd.relation);
    return (
      <div className="text-center">
        <p className="text-sm text-muted">
          The brain hasn&apos;t learned the {cmd.relation} of {cmd.subject} yet. Teach it:{" "}
          <span className="text-foreground">
            {cmd.relation} of {cmd.subject} is …
          </span>
        </p>
        {suggestion ? <Suggestion query={suggestion} onPick={onPick} /> : null}
      </div>
    );
  }

  const others = matches.slice(1).filter((m) => m.score > 0.05);
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-accent">{matches[0].name}</div>
      <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted">
        <span>
          the {cmd.relation} of {cmd.subject}
        </span>
        <ConfidencePill sigma={conf.sigma} score={conf.score} />
      </div>
      {others.length > 0 ? (
        <div className="mt-2 text-xs text-muted/70">
          also considered: {others.map((m) => m.name).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Try to repair a failed ask by resolving the subject/relation to the closest
 * known names. Returns a corrected query string only if the repair differs from
 * the input and produces a confident answer; otherwise null.
 */
function suggestCorrection(
  brain: KnowledgeBrain,
  resolvers: BrainResolvers | null,
  subject: string,
  relation: string,
): string | null {
  if (!resolvers) return null;
  const subj = resolvers.concept.resolve(subject)?.name ?? subject;
  const rel = resolvers.relation.resolve(relation)?.name ?? relation;
  if (subj === subject && rel === relation) return null;
  const conf = recallConfidence(brain.ask(subj, canonicalRelation(rel), 2));
  if (!conf.confident) return null;
  return `${rel} of ${subj}`;
}

/**
 * Translate a confident query into a trace the graph can animate. Mirrors the
 * branches in <Result> (including the typo-repair fallback) but returns the
 * canonical concept names and the hops the "thought" travels along. Returns
 * null when there is nothing worth showing yet.
 */
function buildTrace(
  brain: KnowledgeBrain,
  resolvers: BrainResolvers | null,
  cmd: Command,
): TracePayload | null {
  if (cmd.kind === "ask") {
    let subject = cmd.subject;
    let relation = canonicalRelation(cmd.relation);
    let matches = brain.ask(subject, relation, 4);
    let conf = recallConfidence(matches);
    if (!conf.confident && resolvers) {
      const s2 = resolvers.concept.resolve(cmd.subject)?.name ?? subject;
      const r2 = canonicalRelation(resolvers.relation.resolve(cmd.relation)?.name ?? relation);
      const m2 = brain.ask(s2, r2, 4);
      const c2 = recallConfidence(m2);
      if (c2.confident) {
        subject = s2;
        relation = r2;
        matches = m2;
        conf = c2;
      }
    }
    if (!conf.confident) return null;
    const answer = matches[0].name;
    return {
      kind: "ask",
      focus: [subject],
      answer,
      relation,
      segments: [[subject, answer]],
    };
  }

  if (cmd.kind === "analogy") {
    const matches = brain.analogy(cmd.value, cmd.from, cmd.to, 4);
    const conf = recallConfidence(matches);
    if (!conf.confident) return null;
    const answer = matches[0].name;
    const recovered = brain.recoverRelation(cmd.value, cmd.from, 1)[0];
    return {
      kind: "analogy",
      focus: [cmd.from, cmd.to, cmd.value],
      answer,
      relation: recovered?.name ?? null,
      segments: [
        [cmd.from, cmd.to],
        [cmd.value, answer],
      ],
    };
  }

  if (cmd.kind === "neighbors") {
    const entity = resolvers?.concept.resolve(cmd.entity)?.name ?? cmd.entity;
    const neighbors = brain.similarConcepts(entity, 4).filter((m) => m.score > 0.05);
    if (neighbors.length === 0) return null;
    return {
      kind: "neighbors",
      focus: [entity],
      answer: null,
      relation: null,
      segments: neighbors.slice(0, 3).map((m) => [entity, m.name] as [string, string]),
    };
  }

  return null;
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
