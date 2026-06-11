"use client";

import { useState } from "react";
import { type KnowledgeBrain } from "@/lib/hdc";
import { parseCommand } from "@/lib/parse-command";
import type { TeachOutcome } from "@/lib/use-collective-brain";

interface CommandBarProps {
  value: string;
  onValueChange: (value: string) => void;
  brain: KnowledgeBrain;
  onTeach: (fact: { subject: string; relation: string; object: string }) => Promise<TeachOutcome>;
}

export function CommandBar({ value, onValueChange, brain, onTeach }: CommandBarProps) {
  const [pending, setPending] = useState(false);
  const [taught, setTaught] = useState<TeachOutcome | null>(null);

  const cmd = parseCommand(value);

  async function onSubmit() {
    if (cmd.kind === "teach") {
      setPending(true);
      const outcome = await onTeach(cmd);
      setPending(false);
      setTaught(outcome);
      if (outcome.status === "added") onValueChange("");
    }
  }

  return (
    <div className="w-full">
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setTaught(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        autoFocus
        spellCheck={false}
        placeholder="capital of France"
        aria-label="Ask or teach the brain"
        className="w-full rounded-full border border-border bg-surface/70 px-6 py-4 text-center text-lg text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent/60"
      />

      <div className="mt-6 min-h-[5.5rem]">
        <Result brain={brain} cmd={cmd} pending={pending} taught={taught} />
      </div>
    </div>
  );
}

function Result({
  brain,
  cmd,
  pending,
  taught,
}: {
  brain: KnowledgeBrain;
  cmd: ReturnType<typeof parseCommand>;
  pending: boolean;
  taught: TeachOutcome | null;
}) {
  if (taught) {
    const tone = taught.status === "error" ? "text-negative" : "text-positive";
    return <p className={`text-center text-sm ${tone}`}>{taught.message}</p>;
  }

  if (cmd.kind === "empty") {
    return null;
  }

  if (cmd.kind === "invalid") {
    return <p className="text-center text-sm text-muted">{cmd.message}</p>;
  }

  if (cmd.kind === "teach") {
    return (
      <p className="text-center text-sm text-muted">
        {pending ? (
          "Teaching..."
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

  // Ask
  const matches = brain.ask(cmd.subject, cmd.relation.toLowerCase(), 4);
  if (matches.length === 0 || matches[0].score <= 0.12) {
    return (
      <p className="text-center text-sm text-muted">
        The brain hasn&apos;t learned the {cmd.relation} of {cmd.subject} yet.
        Teach it: <span className="text-foreground">{cmd.relation} of {cmd.subject} is ...</span>
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
