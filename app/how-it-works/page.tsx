import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "A gentle introduction to Hyperdimensional Computing: hypervectors, bind, bundle, permute, and cleanup memory.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 text-muted">
        Haiperbrain is built on{" "}
        <strong className="text-foreground">Hyperdimensional Computing</strong>{" "}
        (HDC), also known as Vector Symbolic Architectures (VSA). It is a real,
        brain-inspired model of computation - not a wrapper around a language
        model. Here is the whole idea in a few minutes.
      </p>

      <Section title="1. Concepts are huge random vectors">
        <p>
          Every atomic concept - a word, a symbol, a feature - is represented by
          a <Term>hypervector</Term>: a vector with thousands of dimensions
          (here, <Mono>D = 10,000</Mono>) whose components are simply{" "}
          <Mono>-1</Mono> or <Mono>+1</Mono>. Vectors are generated at random.
        </p>
        <p>
          In such high-dimensional space, two random vectors are almost always
          nearly <Term>orthogonal</Term> (cosine similarity close to 0). This
          &quot;blessing of dimensionality&quot; is what makes the whole system
          work: there is effectively unlimited room for distinct concepts that
          do not interfere with one another.
        </p>
      </Section>

      <Section title="2. Three operations build everything">
        <p>The entire algebra rests on three reversible operations:</p>
        <ul className="mt-3 space-y-3">
          <li>
            <Mono>bind (a ⊗ b)</Mono> - element-wise multiplication. The result
            is dissimilar to both inputs and is used to associate things, like a
            role with a value (<Mono>capital ⊗ Tokyo</Mono>). Binding is its own
            inverse, so you can unbind to ask questions.
          </li>
          <li>
            <Mono>bundle ([a + b + c])</Mono> - an element-wise majority vote.
            It superimposes several vectors into one that stays{" "}
            <em>similar</em> to each input. This is how sets and memories are
            formed.
          </li>
          <li>
            <Mono>permute (ρ a)</Mono> - a cyclic shift of the components. It
            produces a dissimilar vector while preserving structure, which lets
            us encode order, position and time.
          </li>
        </ul>
      </Section>

      <Section title="3. Cleanup memory turns noise back into symbols">
        <p>
          Combining many vectors produces a result that is only{" "}
          <em>approximately</em> equal to the clean originals. An{" "}
          <Term>item memory</Term> stores every known atomic vector and, given a
          noisy query, returns the closest one by cosine similarity. This
          &quot;cleanup&quot; step is what converts an approximate computation
          back into a concrete, discrete answer.
        </p>
      </Section>

      <Section title="4. Putting it together: the Dollar of Mexico">
        <p>
          Encode each country as a bundle of bound role/value pairs:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`USA    = [ capital ⊗ Washington
         + currency ⊗ Dollar
         + language ⊗ English ]

Mexico = [ capital ⊗ MexicoCity
         + currency ⊗ Peso
         + language ⊗ Spanish ]`}
        </pre>
        <p className="mt-3">
          Binding the two whole records, <Mono>USA ⊗ Mexico</Mono>, yields a
          mapping that swaps each country&apos;s fillers for the other&apos;s.
          Apply it to <Mono>Dollar</Mono> and clean up the result:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`cleanup( Dollar ⊗ (USA ⊗ Mexico) )  ->  Peso`}
        </pre>
        <p className="mt-3">
          No lookup table and no neural network - the answer emerges from
          algebra. The shared brain on the{" "}
          <Link href="/" className="text-accent underline-offset-2 hover:underline">
            home page
          </Link>{" "}
          uses exactly this, bucketed per relation.
        </p>
      </Section>

      <Section title="5. Why it feels brain-like">
        <p>
          Representations are <Term>distributed</Term> and{" "}
          <Term>holographic</Term>: every concept is smeared across all 10,000
          dimensions, so no single component is essential. Damage a third of the
          vector and the memory still resolves correctly - exactly the graceful
          degradation seen in biological neural tissue. Learning is a single
          superposition, so it is one-shot and instant.
        </p>
      </Section>

      <Section title="6. A collective brain">
        <p>
          Because bundling is additive and order-independent, contributions from
          many people fold into the same memory without coordination. Every fact
          a visitor teaches is stored as a small text triple and shared with
          everyone; each browser rebuilds the brain locally from those triples.
          The vector math is identical for all - only the knowledge is shared.
          As a relation&apos;s memory fills up, recall gets fuzzier, mirroring
          the finite capacity of biological associative memory.
        </p>
      </Section>

      <Section title="Going deeper">
        <p>
          The foundational ideas come from Pentti Kanerva&apos;s work on{" "}
          <em>Hyperdimensional Computing</em> and Sparse Distributed Memory, and
          from later work by Rahimi, Rabaey and others on energy-efficient HDC
          classifiers. The implementation here lives in{" "}
          <Mono>lib/hdc/</Mono> and is small enough to read end to end.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
      {children}
    </code>
  );
}
