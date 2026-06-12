"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type KnowledgeBrain } from "@hiperbrain/core";
import { parseCommand } from "@/lib/parse-command";
import type { TeachOutcome } from "@/lib/use-collective-brain";
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
  onTeach: (fact: { subject: string; relation: string; object: string }) => Promise<TeachOutcome>;
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
  if (cmdKind === "analogy") return "reason";
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

export function CommandBar({ value, onValueChange, brain, onTeach }: CommandBarProps) {
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
      if (outcome.status === "added") {
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
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
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
        className="w-full rounded-full border border-border bg-surface/70 px-4 py-3.5 text-center text-base text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent/60 sm:px-6 sm:py-4 sm:text-lg"
      />

      <div className="mt-4 min-h-[4.5rem] sm:mt-6 sm:min-h-[5.5rem]">
        <Result brain={brain} cmd={cmd} pending={pending} taught={showTaught} onPick={pick} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {chips.map((ex) => (
          <button
            key={ex.text}
            type="button"
            onClick={() => pick(ex.text)}
            className="group rounded-full border border-border px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
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
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
        >
          &#x21bb;
        </button>
      </div>
    </div>
  );
}

function Result({
  brain,
  cmd,
  pending,
  taught,
  onPick,
}: {
  brain: KnowledgeBrain;
  cmd: ReturnType<typeof parseCommand>;
  pending: boolean;
  taught: TeachOutcome | null;
  onPick: (text: string) => void;
}) {
  if (taught) {
    const tone = taught.status === "error" ? "text-negative" : "text-positive";
    return <p className={`text-center text-sm ${tone}`}>{taught.message}</p>;
  }

  if (cmd.kind === "empty") {
    return <EmptyState onPick={onPick} />;
  }

  if (cmd.kind === "invalid") {
    return <p className="text-center text-sm text-muted">{cmd.message}</p>;
  }

  if (cmd.kind === "teach") {
    return (
      <p className="text-center text-sm text-muted">
        {pending ? (
          "Teaching…"
        ) : (
          <>
            Press <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">Enter</kbd>{" "}
            to teach: the <span className="text-foreground">{cmd.relation}</span> of{" "}
            <span className="text-foreground">{cmd.subject}</span> is{" "}
            <span className="text-foreground">{cmd.object}</span>
          </>
        )}
      </p>
    );
  }

  if (cmd.kind === "analogy") {
    const matches = brain.analogy(cmd.value, cmd.from, cmd.to, 4);
    if (matches.length === 0 || matches[0].score <= 0.1) {
      return (
        <p className="text-center text-sm text-muted">
          To reason by analogy, the brain needs to know both{" "}
          <span className="text-foreground">{cmd.from}</span> and{" "}
          <span className="text-foreground">{cmd.to}</span> well. Teach it a few facts
          about them first.
        </p>
      );
    }
    const others = matches.slice(1).filter((m) => m.score > 0.05);
    return (
      <div className="text-center">
        <div className="text-3xl font-semibold tracking-tight text-accent">{matches[0].name}</div>
        <div className="mt-1 text-sm text-muted">
          {cmd.from} is to {cmd.value} as {cmd.to} is to{" "}
          <span className="text-foreground">{matches[0].name}</span>
          <span className="ml-2 font-mono text-xs opacity-70">{matches[0].score.toFixed(2)}</span>
        </div>
        <div className="mt-2 text-xs text-muted/60">solved by vector algebra - no lookup</div>
        {others.length > 0 ? (
          <div className="mt-1 text-xs text-muted/70">
            also considered: {others.map((m) => m.name).join(", ")}
          </div>
        ) : null}
      </div>
    );
  }

  // Ask
  const matches = brain.ask(cmd.subject, cmd.relation.toLowerCase(), 4);
  if (matches.length === 0 || matches[0].score <= 0.12) {
    return (
      <p className="text-center text-sm text-muted">
        The brain hasn&apos;t learned the {cmd.relation} of {cmd.subject} yet. Teach it:{" "}
        <span className="text-foreground">
          {cmd.relation} of {cmd.subject} is …
        </span>
      </p>
    );
  }

  const others = matches.slice(1).filter((m) => m.score > 0.05);
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-accent">{matches[0].name}</div>
      <div className="mt-1 text-sm text-muted">
        the {cmd.relation} of {cmd.subject}
        <span className="ml-2 font-mono text-xs opacity-70">{matches[0].score.toFixed(2)}</span>
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
      <div className="mx-auto mt-3 flex max-w-md flex-col gap-1.5">
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
