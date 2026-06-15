"use client";

import { useMemo } from "react";
import { useCollectiveBrain } from "@/lib/use-collective-brain";
import {
  type BenchmarkItem,
  type ItemResult,
  runBenchmark,
} from "@/lib/benchmark";

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ms(value: number): string {
  return value >= 1 ? `${value.toFixed(1)} ms` : `${value.toFixed(2)} ms`;
}

const RUN_DATE = new Date().toISOString().slice(0, 10);

function questionText(item: BenchmarkItem): string {
  return item.kind === "ask"
    ? `the ${item.relation} of ${item.subject}`
    : `${item.from} is to ${item.value} as ${item.to} is to ?`;
}

export function BenchmarkView() {
  const { brain, status, ready, facts } = useCollectiveBrain();
  const loading = status === "loading" || (status === "ready" && !ready);

  const { results, summary } = useMemo(
    () => runBenchmark(brain),
    // Recompute whenever the brain instance changes (i.e. after facts load).
    [brain],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Benchmark</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        The brain answers a fixed set of known-answer questions live, in your browser, right
        now. It is allowed to say &ldquo;I don&apos;t know&rdquo;: an associative memory should
        abstain rather than invent an answer, so the telling number is not just accuracy but how
        rarely it is <span className="text-foreground">confidently wrong</span>.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted">Assembling the brain and scoring…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="accuracy"
              value={pct(summary.accuracy)}
              hint={`${summary.correct}/${summary.total} correct`}
              tone="accent"
            />
            <Metric
              label="precision"
              value={pct(summary.precision)}
              hint="of confident answers"
              tone="positive"
            />
            <Metric
              label="confident-wrong"
              value={pct(summary.hallucinationRate)}
              hint="hallucination analogue"
              tone={summary.confidentWrong === 0 ? "positive" : "negative"}
            />
            <Metric
              label="coverage"
              value={pct(summary.coverage)}
              hint={`${summary.abstained} abstained`}
              tone="muted"
            />
          </div>

          <p className="mt-4 text-xs text-muted">
            {summary.correct} correct, {summary.confidentWrong} confidently wrong, and{" "}
            {summary.abstained} abstained out of {summary.total}. Questions the brain
            hasn&apos;t been taught show up as abstentions, not errors.
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted/80">
            <Meta label="dataset" value={`${summary.version} · ${summary.total} questions`} />
            <Meta label="brain" value={`${facts.length.toLocaleString()} facts loaded`} />
            <Meta
              label="speed"
              value={`${ms(summary.latencyMsAvg)}/query · ${ms(summary.latencyMsTotal)} total`}
            />
            <Meta label="run" value={RUN_DATE} />
          </dl>
          <p className="mt-2 text-[11px] text-muted/60">
            Latency is wall-clock recall in your browser - no server round-trip, no model
            call. Every answer is pure hypervector algebra.
          </p>

          <ul className="mt-6 divide-y divide-border border-y border-border">
            {results.map((r, i) => (
              <ResultRow key={`${questionText(r.item)}-${i}`} result={r} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="uppercase tracking-wider text-muted/50">{label}</dt>
      <dd className="text-muted">{value}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "accent" | "positive" | "negative" | "muted";
}) {
  const color =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "accent"
          ? "text-accent"
          : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-surface/40 p-3">
      <div className={`font-mono text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[11px] text-muted/70">{hint}</div>
    </div>
  );
}

function ResultRow({ result }: { result: ItemResult }) {
  const { item, status, got } = result;
  const badge =
    status === "correct"
      ? "border-positive/40 text-positive"
      : status === "wrong"
        ? "border-negative/40 text-negative"
        : "border-border text-muted";
  const label = status === "abstain" ? "i don't know" : status;

  return (
    <li className="flex items-center justify-between gap-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-mono">{questionText(item)}</div>
        <div className="mt-0.5 text-xs text-muted">
          expected <span className="text-foreground">{item.expected}</span>
          {status === "wrong" && got ? (
            <>
              {" · "}got <span className="text-negative">{got}</span>
            </>
          ) : status === "correct" ? (
            <>
              {" · "}got <span className="text-positive">{got}</span>
            </>
          ) : null}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${badge}`}
      >
        {label}
      </span>
    </li>
  );
}
