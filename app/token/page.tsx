import type { Metadata } from "next";
import { TokenConsole } from "@/components/token/token-console";

export const metadata: Metadata = {
  title: "Token & API",
  description:
    "Burn the hiperbrain token for API credits and query the live collective brain from anywhere.",
  alternates: { canonical: "/token" },
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const USE_CASES = [
  {
    tag: "Collective memory",
    title: "A shared brain your users build together",
    body: "Not a private model — one living, moderated memory that grows as everyone teaches it, with live updates. Give a Discord bot, a game or an app a collective memory without running any backend.",
  },
  {
    tag: "No hallucination",
    title: "Deterministic answers with calibrated confidence",
    body: "An LLM guesses fluently and can be confidently wrong. hiperbrain answers from auditable vector algebra and returns how sure it is in noise-sigmas — and honestly says \u201cunsure\u201d instead of inventing. Built for compliance, automation and anything where a confident mistake is expensive.",
  },
  {
    tag: "Agent tool",
    title: "A grounding memory for AI agents",
    body: "Let your LLM agent call hiperbrain as a verified-facts tool: only AI-checked facts go in, every recall comes back with a confidence score, and it never hallucinates a relationship that was never taught.",
  },
  {
    tag: "Embeddings-free",
    title: "Similarity & one-shot classification, no model",
    body: "Find related concepts or classify text by meaning without an embeddings model or a training run — a few kilobytes of math instead of a GPU bill.",
  },
];

export default function TokenPage() {
  const mint = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";
  const tokenConfigured = BASE58.test(mint);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Token &amp; API</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        The brain on the home page is free to play with. The token powers the
        programmatic layer: burn it for credits, then reason over the live
        collective brain from your own apps, scripts and agents via a simple API.
        Open-source SDK stays free — credits only meter the hosted endpoints.
      </p>

      <section className="mt-10">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
          Why call hiperbrain, not an LLM?
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          It isn&apos;t a replacement for a language model — it&apos;s a different
          tool. Where an LLM <em>guesses</em>, hiperbrain knows exactly what it
          was taught, tells you how sure it is, and never hallucinates. Four
          things it does that an LLM can&apos;t:
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {USE_CASES.map((u, i) => (
            <div key={u.tag} className="rounded-sm border border-border bg-surface/40 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-accent">
                  {u.tag}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground">
                {u.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
          Get a key &amp; start calling
        </h2>
        <div className="mt-6">
          <TokenConsole tokenConfigured={tokenConfigured} />
        </div>
      </section>
    </div>
  );
}
