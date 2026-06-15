"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RobustnessDemo } from "@/components/brain/robustness-demo";
import { ClassifierDemo } from "@/components/brain/classifier-demo";
import { SequenceDemo } from "@/components/brain/sequence-demo";

interface SectionMeta {
  id: string;
  title: string;
  group: string;
}

// Sections are grouped into themed categories and ordered as a reading arc:
// what it is -> the math -> how it reasons -> how it remembers -> the live
// system -> reference. The on-page order, the table of contents and the section
// numbers are all derived from this single list, so reordering is just editing
// this array.
const SECTIONS: SectionMeta[] = [
  // Introduction
  { id: "overview", title: "A third path in AI", group: "Introduction" },
  { id: "compare", title: "HDC vs. large language models", group: "Introduction" },

  // The foundations
  { id: "dimensionality", title: "Why 10,000 dimensions", group: "The foundations" },
  { id: "hypervector", title: "The hypervector: ±1 in 10,000 slots", group: "The foundations" },
  { id: "operations", title: "Three operations build all of thought", group: "The foundations" },
  { id: "cleanup", title: "Cleanup memory: noise back into meaning", group: "The foundations" },
  { id: "structures", title: "Encoding records, sequences and graphs", group: "The foundations" },
  { id: "speed", title: "Bit-packed hypervectors: 8x smaller, far faster", group: "The foundations" },

  // Reasoning & intelligence
  { id: "analogy", title: "Reasoning by analogy: the Dollar of Mexico", group: "Reasoning & intelligence" },
  { id: "explain", title: "Explainable analogy: it shows its reasoning", group: "Reasoning & intelligence" },
  { id: "neighbors", title: "Semantic neighbourhoods: concepts like X", group: "Reasoning & intelligence" },
  { id: "confidence", title: "Calibrated confidence: knowing when it knows", group: "Reasoning & intelligence" },
  { id: "beyond", title: "Beyond facts: sequences and one-shot classification", group: "Reasoning & intelligence" },

  // Memory & robustness
  { id: "holographic", title: "Holographic memory and fault tolerance", group: "Memory & robustness" },
  { id: "oneshot", title: "One-shot, instant learning", group: "Memory & robustness" },
  { id: "capacity", title: "Finite capacity and graceful forgetting", group: "Memory & robustness" },

  // The collective system
  { id: "collective", title: "A brain the whole internet builds", group: "The collective system" },
  { id: "architecture", title: "How hiperbrain is built", group: "The collective system" },
  { id: "trust", title: "Provenance, verification and resolving contradictions", group: "The collective system" },
  { id: "commands", title: "The command language", group: "The collective system" },
  { id: "resolver", title: "Typo-tolerant input: fault tolerance for what you type", group: "The collective system" },

  // Reference
  { id: "benchmark", title: "The public benchmark: measured, not claimed", group: "Reference" },
  { id: "limits", title: "Where it is honest about its limits", group: "Reference" },
  { id: "science", title: "The science behind it", group: "Reference" },
  { id: "faq", title: "Frequently asked questions", group: "Reference" },
  { id: "glossary", title: "Glossary", group: "Reference" },
  { id: "sdk", title: "Use the engine yourself: @hiperbrain/core", group: "Reference" },
  { id: "api", title: "Token & API: query the brain from anywhere", group: "Reference" },
  { id: "apiref", title: "API reference: every endpoint", group: "Reference" },
];

const pad = (n: number) => String(n).padStart(2, "0");

// Section bodies, keyed by id, so the render order is driven purely by SECTIONS.
const CONTENT: Record<string, React.ReactNode> = {
  overview: (
    <>
      <p>
        The last decade of AI has been a story of two extremes. On one side,
        <Term> deep neural networks</Term> - astonishingly capable, but their
        knowledge is buried in billions of floating-point weights that no human
        can read. On the other, <Term>symbolic systems</Term> - rules and logic
        you can inspect line by line, but rigid and brittle the moment reality
        does not match the rule book.
      </p>
      <p>
        Hyperdimensional Computing is the rarely-travelled middle road. It keeps
        the inspectability of symbols - every concept is a named vector you can
        print out - while gaining the noise-tolerance and graceful degradation
        of neural tissue. Crucially, it replaces training with{" "}
        <em>algebra</em>: to know something, you add a vector; to ask something,
        you multiply. There is no loss function, no backpropagation, no epochs.
      </p>
      <p>
        This page is the long-form explanation of how that works, grouped into
        themes. Every claim here maps to code you can read in{" "}
        <Mono>packages/core/src/</Mono>. Use the menu on the left to jump around, and
        expand only the parts you care about.
      </p>
    </>
  ),

  compare: (
    <>
      <p>
        HDC has decades of serious research behind it, but it has lived in
        academic papers and embedded-hardware labs - not as something the public
        can touch. Compare the paradigm to mainstream &quot;AI&quot;:
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Compare
          heading="Large language models"
          points={[
            "Black box - billions of opaque weights",
            "Training costs millions; updates are slow",
            "Runs on GPU clusters, per-call API cost",
            "Hallucinates; reasoning is implicit",
            "Knowledge frozen at training time",
          ]}
          tone="muted"
        />
        <Compare
          heading="hiperbrain (HDC)"
          points={[
            "Transparent - read the whole engine yourself",
            "Learns a new fact in one step, instantly",
            "Runs on a plain CPU, in your browser, free",
            "Reasoning is explicit, inspectable algebra",
            "Knowledge grows live as people teach it",
          ]}
          tone="accent"
        />
      </div>
    </>
  ),

  dimensionality: (
    <>
      <p>
        The single most counter-intuitive idea in HDC is that{" "}
        <em>bigger is simpler</em>. We represent each concept with a vector of{" "}
        <Mono>D = 10,000</Mono> dimensions. Why so many? Because of the{" "}
        <Term>blessing of dimensionality</Term>.
      </p>
      <p>
        In very high-dimensional space, two vectors picked at random are almost
        always <em>near-orthogonal</em> - their cosine similarity clusters
        tightly around zero. With 10,000 bipolar dimensions, the chance that two
        random concepts look alike by accident is astronomically small (the
        similarity of independent random vectors has a standard deviation of
        about <Mono>1/√D ≈ 0.01</Mono>). In practice this means there is{" "}
        <em>effectively unlimited room</em> for distinct concepts that never
        collide.
      </p>
      <ul className="mt-3 space-y-2">
        <li>
          <Term>Capacity:</Term> millions of distinct symbols can coexist before
          any two become confusable.
        </li>
        <li>
          <Term>Robustness:</Term> meaning is spread across all dimensions, so
          losing some of them barely moves the vector.
        </li>
        <li>
          <Term>Stability:</Term> small amounts of noise stay small - the
          geometry does not amplify errors the way low-dimensional spaces do.
        </li>
      </ul>
      <p className="mt-3">
        Randomness is not a bug here - it is the entire source of capacity. We do
        not hand-design vectors; we let high-dimensional geometry do the work.
      </p>
    </>
  ),

  hypervector: (
    <>
      <p>
        An atomic concept - a word, a symbol, a feature - is represented by a{" "}
        <Term>hypervector</Term> whose components are each either <Mono>-1</Mono>{" "}
        or <Mono>+1</Mono>. This is the <em>bipolar</em> representation, and it is
        chosen deliberately:
      </p>
      <ul className="mt-3 space-y-2">
        <li>
          Element-wise multiplication of two <Mono>±1</Mono> vectors is again a{" "}
          <Mono>±1</Mono> vector - the algebra stays closed and cheap.
        </li>
        <li>
          A bipolar vector is its own inverse under multiplication (
          <Mono>x ⊗ x = 1</Mono>), which is what makes binding reversible.
        </li>
        <li>
          Similarity is just a normalised dot product, computable with integer
          math - no floating point required for the core.
        </li>
      </ul>
      <p className="mt-3">
        A single 10,000-dimensional bipolar vector packs into about{" "}
        <Mono>1.25 KB</Mono> if stored as bits. The whole &quot;mind&quot; is a
        handful of these vectors plus a dictionary mapping names to them - small
        enough to ship to every browser.
      </p>
    </>
  ),

  operations: (
    <>
      <p>
        The whole system rests on three operations. That is the entire
        instruction set of this brain:
      </p>
      <ul className="mt-3 space-y-3">
        <li>
          <Mono>bind (a ⊗ b)</Mono> - element-wise multiply. The result is
          dissimilar to both inputs and is used to <em>associate</em> things,
          like a role with a value: <Mono>capital ⊗ Tokyo</Mono>. Binding is its
          own inverse, so you can &quot;unbind&quot; later to ask a question.
        </li>
        <li>
          <Mono>bundle ([a + b + c])</Mono> - an element-wise majority vote. It
          superimposes many vectors into one that stays <em>similar</em> to each
          input. This is how sets, records and memories are formed - many ideas
          living inside a single vector at once.
        </li>
        <li>
          <Mono>permute (ρ a)</Mono> - a cyclic shift of the components. It makes
          a dissimilar vector while preserving structure, which lets us encode
          order, position and time.
        </li>
      </ul>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground">
              <th className="py-2 pr-4 font-medium">Operation</th>
              <th className="py-2 pr-4 font-medium">Output similar to input?</th>
              <th className="py-2 font-medium">Reversible?</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            <tr className="border-b border-border/50">
              <td className="py-2 pr-4"><Mono>bind</Mono></td>
              <td className="py-2 pr-4">No - becomes dissimilar</td>
              <td className="py-2">Yes - bind again to undo</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 pr-4"><Mono>bundle</Mono></td>
              <td className="py-2 pr-4">Yes - stays similar to all</td>
              <td className="py-2">No - lossy superposition</td>
            </tr>
            <tr>
              <td className="py-2 pr-4"><Mono>permute</Mono></td>
              <td className="py-2 pr-4">No - becomes dissimilar</td>
              <td className="py-2">Yes - shift back</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3">
        Bind, bundle, permute. From these three primitives - and nothing else -
        you can build records, sequences, graphs, and the reasoning below.
      </p>
    </>
  ),

  cleanup: (
    <>
      <p>
        Combining many vectors produces a result that is only{" "}
        <em>approximately</em> equal to the clean originals. An{" "}
        <Term>item memory</Term> (also called cleanup memory) stores every known
        atomic vector and, given a noisy query, returns the closest one by{" "}
        <Term>cosine similarity</Term>.
      </p>
      <p>
        This is the brain&apos;s moment of recognition: it takes a smeared,
        in-between vector that came out of some computation and snaps it back to
        the nearest real concept. Without cleanup, HDC would drift into noise
        after a few operations; with it, you can chain operations and still land
        on crisp, discrete answers.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`query  = noisy vector (~70% correct)
cleanup(query) = argmax over all known
                 symbols of cosine(query, symbol)`}
      </pre>
    </>
  ),

  structures: (
    <>
      <p>
        The three operations compose into rich data structures - all living
        inside single fixed-size vectors:
      </p>
      <ul className="mt-3 space-y-3">
        <li>
          <Term>Records (key-value):</Term> bind each field to its value and
          bundle them. <Mono>[ name ⊗ Ada + born ⊗ 1815 ]</Mono>. To read a
          field, unbind by its key and clean up:{" "}
          <Mono>cleanup(record ⊗ name) -&gt; Ada</Mono>.
        </li>
        <li>
          <Term>Sequences (order):</Term> permute each element by its position
          before bundling. <Mono>[ ρ⁰a + ρ¹b + ρ²c ]</Mono>. Permutation makes
          position matter, so <Mono>abc</Mono> and <Mono>cba</Mono> become
          different vectors.
        </li>
        <li>
          <Term>Sets:</Term> just bundle the members. Order-independent,
          membership testable by similarity.
        </li>
        <li>
          <Term>Graphs:</Term> bind node pairs to edge-type vectors and bundle
          them into one vector that represents an entire labelled graph.
        </li>
      </ul>
      <p className="mt-3">
        Everything - a fact, a record, an ordered story, a knowledge graph -
        ends up as one vector of the same length. That uniformity is what makes
        the algebra so composable.
      </p>
    </>
  ),

  speed: (
    <>
      <p>
        A bipolar vector carries exactly one bit of information per dimension, yet
        a byte array spends eight. hiperbrain ships a <Term>bit-packed</Term>{" "}
        representation that stores each dimension as a single bit, and the two
        hottest operations collapse into machine-native instructions:
      </p>
      <ul className="mt-3 space-y-2">
        <li>
          <Term>bind</Term> becomes a bitwise <Mono>XOR</Mono> - 32 dimensions per
          CPU op instead of one multiply at a time.
        </li>
        <li>
          <Term>similarity</Term> becomes <Mono>popcount(a XOR b)</Mono> - the
          Hamming distance maps exactly onto cosine via{" "}
          <Mono>(D − 2·hamming) / D</Mono>, so the ranking is identical.
        </li>
      </ul>
      <p className="mt-3">
        The result is an <Mono>8x</Mono> smaller memory footprint (a 10,000-d
        vector drops from ~10&nbsp;KB to ~1.25&nbsp;KB) and a large speed-up when
        cleaning a query against many candidates - which is exactly what every
        <Mono>ask</Mono>, <Mono>analogy</Mono> and neighbour search does. The
        readable <Mono>±1</Mono> form remains the canonical API; the packed path is
        a transparent accelerator exposed as <Mono>packBits</Mono>,{" "}
        <Mono>bindPacked</Mono> and <Mono>similarityPacked</Mono>.
      </p>
    </>
  ),

  analogy: (
    <>
      <p>
        Here is where it stops feeling like a database and starts feeling like a
        mind. Encode each country as a <Term>record</Term>: a bundle of bound
        role/value pairs.
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
        Now bind the two whole records together. Every aligned role cancels
        (because <Mono>r ⊗ r = 1</Mono>), leaving a single vector that{" "}
        <em>swaps each country&apos;s fillers for the other&apos;s</em>. Apply it
        to <Mono>Dollar</Mono> and clean up the result:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`cleanup( Dollar ⊗ (USA ⊗ Mexico) )  ->  Peso`}
      </pre>
      <p className="mt-3">
        Nobody told the brain that &quot;Dollar relates to Peso.&quot; It was
        never taught that pairing. The answer emerges from the algebra itself.
        This is live on the{" "}
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          home page
        </Link>{" "}
        - just type <Mono>USA is to Dollar as Mexico is to ?</Mono> and watch it
        reason.
      </p>
    </>
  ),

  explain: (
    <>
      <p>
        Black-box models give you an answer and ask you to take it on faith.
        hiperbrain can show the <em>step</em> in between. When it solves{" "}
        <Mono>USA is to Dollar as Mexico is to ?</Mono>, the very first thing the
        algebra does is recover the <em>relation</em> that connects Dollar to the
        USA - the role <Mono>currency</Mono> - purely as a vector:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`role  = cleanup( Dollar ⊗ record(USA) )   ->  currency
answer = cleanup( role  ⊗ record(Mexico) ) ->  Peso`}
      </pre>
      <p className="mt-3">
        Both steps are exposed: <Mono>recoverRelation()</Mono> returns the deduced
        relation, so the interface can print &quot;deduced relation: currency&quot;
        beneath the answer. No rules, no lookup table, no prompt - the reasoning is
        literally two multiplications you can audit.
      </p>
    </>
  ),

  neighbors: (
    <>
      <p>
        Every entity also gets a <Term>holographic record</Term> - one vector that
        superimposes all of its <Mono>(relation ⊗ object)</Mono> pairs. Two
        entities that share properties (same currency, same continent, same
        category) end up with similar records, <em>automatically</em>.
      </p>
      <p>
        So &quot;which concepts are like France?&quot; becomes a single similarity
        sweep over records - no clustering algorithm, no embeddings model, no
        training. Type <Mono>concepts like France</Mono> on the home page and the
        brain surfaces its nearest neighbours, ranked by how much of their meaning
        overlaps. It is emergent structure falling straight out of the algebra.
      </p>
    </>
  ),

  confidence: (
    <>
      <p>
        A recall is only as useful as your ability to trust it. Because the
        cosine similarity of two <em>random</em> hypervectors has a standard
        deviation of about <Mono>1/√D ≈ 0.01</Mono>, hiperbrain can express any
        answer&apos;s strength in <Term>noise sigmas</Term> - how many standard
        deviations above pure chance the top match sits.
      </p>
      <p>
        Instead of a hand-picked threshold, every answer is scored on two axes:
        how far it rises above the noise floor, and how far it leads the
        runner-up. Only results that clear both are marked{" "}
        <Term>confident</Term>; everything else is flagged as a guess. That is why
        the home page can say not just <em>what</em> it thinks, but{" "}
        <em>how sure</em> it is - and why a crowded relation degrades into an
        honest &quot;unsure&quot; rather than a confident wrong answer.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`sigma   = topScore / (1/√D)        // signal vs. chance
margin  = (top - second) / (1/√D)  // lead over runner-up
confident = sigma >= 4 && margin >= 2`}
      </pre>
      <p className="mt-3">
        It is one function - <Mono>recallConfidence()</Mono> - and it is exported
        from the SDK so your own apps can make the same call.
      </p>
    </>
  ),

  beyond: (
    <>
      <p>
        The same three operations that store facts also store{" "}
        <em>knowledge of a very different shape</em>. Two examples run live, right
        here, entirely on your CPU.
      </p>
      <p className="mt-2 font-medium text-foreground">One-shot language identification</p>
      <p>
        The brain learns four languages from a handful of sentences each - one
        bundling step per language, no training loop - then labels anything you
        type by which prototype its n-gram fingerprint is closest to:
      </p>
      <div className="mt-4">
        <ClassifierDemo />
      </div>
      <p className="mt-6 font-medium text-foreground">Sequence memory and prediction</p>
      <p>
        An entire ordered list is folded into a <em>single</em> vector by permuting
        each element by its position; a transition memory predicts what comes next.
        Pick an item and watch it reason about order:
      </p>
      <div className="mt-4">
        <SequenceDemo />
      </div>
    </>
  ),

  holographic: (
    <>
      <p>
        Representations are <Term>distributed</Term> and <Term>holographic</Term>
        : every concept is smeared across all 10,000 dimensions, so no single
        component is essential - exactly like a hologram, where each fragment
        still contains the whole image, just blurrier. Damage a large chunk of
        the vector and the memory still resolves correctly.
      </p>
      <p>
        This is the graceful degradation seen in biological neural tissue, and it
        is nothing like a normal computer, where flipping a few bits corrupts the
        data entirely. Don&apos;t take our word for it - pick a concept and
        destroy up to half of its bits; the brain still recognises it:
      </p>
      <div className="mt-4">
        <RobustnessDemo />
      </div>
    </>
  ),

  oneshot: (
    <>
      <p>
        There is no training loop, no gradient descent, no model to download.
        &quot;Learning&quot; a fact is literally one bundling step - a single
        addition into a memory vector. The brain knows it the instant you teach
        it.
      </p>
      <p>
        This is closer to how a person remembers a new name on hearing it once
        than to how a neural network is trained over millions of examples. It
        also means there is no catastrophic forgetting in the usual sense: adding
        a new fact never overwrites an unrelated one, it just superimposes
        another faint layer onto the relevant memory.
      </p>
    </>
  ),

  capacity: (
    <>
      <p>
        Each relation keeps one bundled memory vector, and a bundle can only hold
        so much before recall gets fuzzy. So as a relation fills up, answers
        degrade <em>gradually</em> rather than failing all at once - the same
        capacity-limited, lossy behaviour as biological associative memory.
      </p>
      <p>
        To keep recall sharp, hiperbrain <Term>buckets knowledge by relation</Term>:
        all <Mono>capital-of</Mono> facts share one vector, all{" "}
        <Mono>currency-of</Mono> facts another, and so on. Each memory therefore
        only ever competes with facts of the same kind, which keeps similarity
        scores clean and answers confident far longer than a single global bundle
        would allow.
      </p>
    </>
  ),

  collective: (
    <>
      <p>
        Because bundling is commutative and order-independent, contributions from
        thousands of people fold into the same memory without any coordination.
        Every fact a visitor teaches is stored as a tiny text triple{" "}
        <Mono>(subject, relation, object)</Mono> and shared with everyone.
      </p>
      <p>
        Each browser rebuilds the brain locally from those triples and streams
        new ones live as other people teach them. The vector math is identical
        for all - only the knowledge is shared, and it grows every minute. The
        brain you interact with is, quite literally, the sum of everyone who came
        before you.
      </p>
    </>
  ),

  architecture: (
    <>
      <p>
        The architecture is deliberately split so the <em>thinking</em> happens
        on your device and the server only ever stores plain text:
      </p>
      <ul className="mt-3 space-y-3">
        <li>
          <Term>Client (your browser):</Term> all hypervector math -{" "}
          <Mono>bind</Mono>, <Mono>bundle</Mono>, <Mono>permute</Mono>, cleanup,
          analogy - runs here in TypeScript. The brain is rebuilt from the fact
          list every time it changes.
        </li>
        <li>
          <Term>Server (Supabase / Postgres):</Term> stores the shared facts as
          text triples and broadcasts new ones over a realtime channel. It never
          stores or computes vectors.
        </li>
        <li>
          <Term>Live sync:</Term> when anyone teaches a fact, it is written to
          Postgres and pushed to every connected browser, which folds it into its
          local brain instantly.
        </li>
        <li>
          <Term>Moderation:</Term> every write passes server-side input
          validation, a content blocklist, per-IP rate limiting, duplicate
          detection and a global capacity cap before it is accepted.
        </li>
      </ul>
      <p className="mt-3">
        Reads are cached briefly and paginated, so the shared brain can grow well
        beyond a single database page without the client ever noticing.
      </p>
    </>
  ),

  commands: (
    <>
      <p>
        You drive the brain with one input box and a tiny, predictable grammar.
        There are four things you can say:
      </p>
      <ul className="mt-3 space-y-3">
        <li>
          <Term>Teach</Term> - state a fact:{" "}
          <Mono>Tokyo is the capital of Japan</Mono> or{" "}
          <Mono>capital of Japan is Tokyo</Mono>.
        </li>
        <li>
          <Term>Ask</Term> - query a relation:{" "}
          <Mono>capital of Japan</Mono> or <Mono>what is the capital of Japan</Mono>.
        </li>
        <li>
          <Term>Analogy</Term> - reason across records:{" "}
          <Mono>Japan is to Tokyo as France is to ?</Mono>.
        </li>
        <li>
          <Term>Neighbours</Term> - explore meaning:{" "}
          <Mono>concepts like France</Mono> or <Mono>similar to Gold</Mono>.
        </li>
      </ul>
      <p className="mt-3">
        The parser is intentionally simple and transparent - it lives in{" "}
        <Mono>lib/parse-command.ts</Mono> - so you always know exactly how your
        words become vectors. No hidden interpretation, no language model
        guessing your intent. And if you misspell a name, a typo-tolerant resolver
        quietly offers the closest known concept.
      </p>
    </>
  ),

  resolver: (
    <>
      <p>
        The engine is famously tolerant of noise <em>inside</em> its vectors - so
        why should a single typo in your <em>input</em> defeat it? It shouldn&apos;t.
        hiperbrain encodes every known name into a character-n-gram fingerprint and
        resolves what you type to the nearest one.
      </p>
      <p>
        Misspell <Mono>Frnace</Mono>, <Mono>captial</Mono> or{" "}
        <Mono>currancy</Mono> and the resolver still lands on the concept you
        meant, then offers a one-tap correction. The unigram component makes it
        robust to transposed letters, while bi- and tri-grams keep genuinely
        different words apart. It is the brain&apos;s fault tolerance applied to the
        keyboard - shipped as <Mono>ConceptResolver</Mono> in the SDK.
      </p>
    </>
  ),

  limits: (
    <>
      <p>
        This is not magic and not an LLM. It does not understand language: it does
        not know that &quot;capital&quot; and &quot;main city&quot; mean the same
        thing, and it cannot chain steps on its own (&quot;the capital of the
        country whose currency is the Yen&quot;).
      </p>
      <p>
        It knows what it has been taught, and reasons over that with vectors.
        Recall is probabilistic, so a heavily loaded relation can occasionally
        return a near-miss. That honesty is the point - everything it does, you
        can see, measure and verify.
      </p>
    </>
  ),

  science: (
    <>
      <p>
        The foundations come from Pentti Kanerva&apos;s work on{" "}
        <em>Hyperdimensional Computing</em> and <em>Sparse Distributed Memory</em>,
        Tony Plate&apos;s <em>Holographic Reduced Representations</em>, and later
        energy-efficient HDC classifiers from Rahimi, Rabaey and others.
      </p>
      <p>
        The implementation here lives in <Mono>packages/core/src/</Mono> - published
        as <Mono>@hiperbrain/core</Mono> on npm - and is small enough to read end to
        end, with no hidden weights and no surprises.
      </p>
      <p className="mt-4">
        <Link
          href="/"
          className="inline-block rounded-md border border-accent/40 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
        >
          Go teach the brain something
        </Link>
      </p>
    </>
  ),

  faq: (
    <>
      <Faq
        q="Is this a large language model?"
        a="No. There is no neural network and no training. Concepts are random ±1 vectors, and answers come from explicit vector algebra you can inspect."
      />
      <Faq
        q="Does it use my GPU or call an API?"
        a="Neither. All reasoning is integer-ish vector math that runs on your CPU in the browser. The server only stores and syncs text facts."
      />
      <Faq
        q="What happens to facts I teach?"
        a="They are stored as a plain (subject, relation, object) triple, moderated, and shared with everyone so the collective brain grows."
      />
      <Faq
        q="Why does it sometimes get an answer slightly wrong?"
        a="Recall is similarity-based. When a relation holds a lot of facts, the bundled memory gets crowded and the nearest match can be a near-miss - graceful degradation, by design."
      />
      <Faq
        q="Can I read the source?"
        a="Yes - the entire engine is a few small files in packages/core/src/, published as @hiperbrain/core on npm, and the project is open on GitHub."
      />
    </>
  ),

  glossary: (
    <dl className="space-y-3">
      <GlossaryItem term="Hypervector">
        A vector with thousands of dimensions (here 10,000), each component{" "}
        <Mono>-1</Mono> or <Mono>+1</Mono>, used to represent one concept.
      </GlossaryItem>
      <GlossaryItem term="Bind (⊗)">
        Element-wise multiplication; associates two vectors into a new,
        dissimilar one. Its own inverse.
      </GlossaryItem>
      <GlossaryItem term="Bundle (+)">
        Element-wise majority vote; superimposes vectors into one that stays
        similar to all of them.
      </GlossaryItem>
      <GlossaryItem term="Permute (ρ)">
        A cyclic shift of components; encodes order and position.
      </GlossaryItem>
      <GlossaryItem term="Item / cleanup memory">
        A dictionary of known vectors that snaps a noisy query back to the
        nearest real concept.
      </GlossaryItem>
      <GlossaryItem term="Cosine similarity">
        A normalised dot product measuring how aligned two vectors are, from{" "}
        <Mono>-1</Mono> to <Mono>+1</Mono>.
      </GlossaryItem>
      <GlossaryItem term="Blessing of dimensionality">
        The fact that random high-dimensional vectors are almost always
        near-orthogonal, giving enormous capacity.
      </GlossaryItem>
      <GlossaryItem term="Holographic representation">
        Information spread across all dimensions, so any fragment still
        contains (a blurrier version of) the whole.
      </GlossaryItem>
      <GlossaryItem term="Holographic record">
        One vector per entity that superimposes all its{" "}
        <Mono>(relation ⊗ object)</Mono> pairs - the basis for analogy and
        semantic-neighbour search.
      </GlossaryItem>
      <GlossaryItem term="Noise sigma">
        How many standard deviations (<Mono>1/√D</Mono>) a similarity score sits
        above the chance level of random vectors - the unit of calibrated
        confidence.
      </GlossaryItem>
      <GlossaryItem term="Bit-packing">
        Storing each <Mono>±1</Mono> dimension as a single bit, turning bind into
        XOR and similarity into popcount for an 8x smaller, faster engine.
      </GlossaryItem>
      <GlossaryItem term="Hamming distance">
        The number of positions at which two packed vectors differ; maps exactly
        onto cosine similarity for bipolar vectors.
      </GlossaryItem>
    </dl>
  ),

  sdk: (
    <>
      <p>
        The engine that powers this whole site is published as a tiny,
        dependency-free npm package -{" "}
        <Mono>@hiperbrain/core</Mono>. It is the exact same code that runs in the
        page you are reading: nothing is held back. Drop it into your own project
        and you get one-shot learning, analogy and fault-tolerant recall in a few
        kilobytes of math that runs in the browser, Node, Deno, Bun or at the
        edge.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`npm install @hiperbrain/core`}
      </pre>
      <p className="mt-3">
        Build your own collective memory in four lines:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`import { KnowledgeBrain, recallConfidence } from "@hiperbrain/core";

const brain = new KnowledgeBrain();
brain.learn({ subject: "France", relation: "capital",  object: "Paris" });
brain.learn({ subject: "France", relation: "currency", object: "Euro" });
brain.learn({ subject: "Japan",  relation: "currency", object: "Yen" });

brain.ask("France", "capital");           // -> [{ name: "Paris", ... }]
brain.analogy("Yen", "Japan", "France");  // -> [{ name: "Euro", ... }]
brain.recoverRelation("Yen", "Japan");    // -> [{ name: "currency", ... }]
brain.similarConcepts("France");          // -> nearest entities by record
recallConfidence(brain.ask("France", "capital")); // -> { confident, sigma }`}
      </pre>
      <p className="mt-3">
        Make input robust with the typo-tolerant <Mono>ConceptResolver</Mono>, or
        reach for the raw primitives - <Mono>bind</Mono>, <Mono>bundle</Mono>,{" "}
        <Mono>permute</Mono>, <Mono>cosineSimilarity</Mono> - the bit-packed fast
        path (<Mono>packBits</Mono>, <Mono>bindPacked</Mono>,{" "}
        <Mono>similarityPacked</Mono>) and the <Mono>Brain</Mono> facade for records,
        text classification and sequence memory. Everything is deterministic: the
        same input always yields the same vector, so results are reproducible and
        testable.
      </p>
      <p className="mt-4 flex flex-wrap gap-3">
        <a
          href="https://www.npmjs.com/package/@hiperbrain/core"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md border border-accent/40 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
        >
          View on npm
        </a>
        <a
          href="https://github.com/bytebrox/hiperbrain"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          Source on GitHub
        </a>
      </p>
    </>
  ),
  api: (
    <>
      <p>
        The SDK runs offline and knows only what you teach it. The{" "}
        <Mono>hiperbrain</Mono> token unlocks the other half: a credit-metered
        HTTP API that reasons over the <em>live collective brain</em> — every
        fact the whole community has ever taught — from your own apps, scripts
        and agents. The public brain on the home page stays free; the token only
        meters this programmatic layer.
      </p>
      <p className="mt-4">
        It is <em>not</em> a replacement for a language model — it is a different
        tool. Where an LLM <em>guesses</em>, hiperbrain knows exactly what it was
        taught, reports how sure it is, and never hallucinates. Four things it
        does that an LLM can&apos;t:
      </p>
      <ul className="mt-3 space-y-3">
        <li>
          <Term>A shared, living memory:</Term> not a private model but one
          collective, moderated memory that grows as everyone teaches it, streamed
          live. Give a Discord bot, a game or an app a shared brain without running
          any backend.
        </li>
        <li>
          <Term>No hallucination, calibrated confidence:</Term> every answer comes
          from auditable vector algebra and reports its certainty in noise-sigmas,
          degrading into an honest &ldquo;unsure&rdquo; instead of a confident
          wrong answer. Built for compliance, automation and anything where a
          confident mistake is expensive.
        </li>
        <li>
          <Term>A grounding tool for AI agents:</Term> let an LLM agent call
          hiperbrain as a verified-facts memory — only AI-checked facts go in,
          every recall returns a confidence score, and it never invents a
          relationship that was never taught.
        </li>
        <li>
          <Term>Embeddings-free similarity &amp; classification:</Term> find
          related concepts (<Mono>similarConcepts</Mono>) or label text by meaning
          with no embeddings model and no training run — a few kilobytes of math
          instead of a GPU bill.
        </li>
      </ul>
      <p className="mt-4">
        It works as a token sink: you <strong>burn</strong> tokens on Solana, the
        burn is verified on-chain, and your wallet is granted off-chain credits.
        A read (<Mono>ask</Mono>) costs 1 credit; a permanent, AI-verified write
        (<Mono>teach</Mono>) costs 10. Every burned token is removed from supply
        forever.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`curl -X POST https://www.hiperbrain.com/api/v1/ask \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"France","relation":"capital"}'

# -> { "answer": "Paris", "confidence": { "confident": true, ... }, "remaining": 999 }`}
      </pre>
      <p className="mt-3">
        Connect a wallet, burn for credits and mint an API key on the{" "}
        <a href="/token" className="text-accent hover:underline">
          Token &amp; API
        </a>{" "}
        page. The flow is wired end-to-end and goes live the moment the token
        mint is set.
      </p>
    </>
  ),
  apiref: (
    <>
      <p>
        Every endpoint shares one base URL —{" "}
        <Mono>https://www.hiperbrain.com</Mono> — and one path per action.
        Metered endpoints require an API key in the{" "}
        <Mono>Authorization: Bearer &lt;key&gt;</Mono> header; mint a key on the{" "}
        <a href="/token" className="text-accent hover:underline">
          Token &amp; API
        </a>{" "}
        page. All request and response bodies are JSON.
      </p>

      <p className="mt-4">
        <Term>POST /api/v1/ask</Term> — recall an answer. Costs 1 credit.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`// Request body
{ "subject": "France", "relation": "capital", "k": 5 }  // k optional (1-10, default 5)

// 200 OK
{
  "answer": "Paris",
  "matches": [{ "name": "Paris", "score": 0.068 }, ...],
  "confidence": { "score": 0.48, "confident": true, "sigma": 6.84 },
  "remaining": 999            // credits left after this call
}`}
      </pre>

      <p className="mt-4">
        <Term>POST /api/v1/teach</Term> — add a fact. Costs 10 credits, but only
        when the fact is genuinely new and passes verification — duplicates and
        rejected facts are refunded automatically.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`// Request body
{ "subject": "Slovenia", "relation": "capital", "object": "Ljubljana" }

// 201 Created — fact stored, 10 credits charged
{ "status": "added", "fact": {...}, "total": 6116, "remaining": 989 }

// 200 OK — already known, charge refunded
{ "status": "duplicate", "fact": {...}, "total": 6116, "remaining": 999 }`}
      </pre>

      <p className="mt-4">
        <Term>GET /api/credits/balance</Term> — check remaining credits. Free.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-2/50 p-4 font-mono text-xs text-foreground">
{`// 200 OK
{ "balance": 989 }`}
      </pre>

      <p className="mt-4">
        The wallet flow uses three more endpoints, all driven by the{" "}
        <a href="/token" className="text-accent hover:underline">
          Token &amp; API
        </a>{" "}
        page: <Mono>POST /api/solana/prepare</Mono> builds an unsigned burn
        transaction, <Mono>POST /api/credits/redeem</Mono> turns a confirmed burn
        signature into credits (idempotent — one burn credits once), and{" "}
        <Mono>POST /api/credits/key</Mono> issues a key after you sign a message
        proving you own the wallet.
      </p>

      <p className="mt-4">
        <Term>Status codes</Term>
      </p>
      <ul className="mt-2 space-y-2">
        <li>
          <Mono>200 / 201</Mono> — success (201 when a fact is created).
        </li>
        <li>
          <Mono>400</Mono> — malformed body or invalid fact (length,
          character-set or nonsense checks).
        </li>
        <li>
          <Mono>401</Mono> — missing or unknown API key.
        </li>
        <li>
          <Mono>402</Mono> — out of credits. Burn more tokens to top up; nothing
          is charged on a 402.
        </li>
        <li>
          <Mono>409</Mono> — the brain is at capacity (the charge is refunded).
        </li>
        <li>
          <Mono>422</Mono> — the AI fact-checker is confident the claim is false,
          so the write was rejected (no charge).
        </li>
      </ul>
    </>
  ),

  trust: (
    <>
      <p>
        A brain the whole internet can write to needs a way to stay clean. Every
        taught fact carries <Term>provenance</Term> - where it came from
        (<Mono>seed</Mono>, <Mono>community</Mono> or the metered <Mono>api</Mono>),
        who taught it (the wallet, for API writes), a fact-checker{" "}
        <Term>verdict</Term> and a numeric <Term>confidence</Term>. None of this
        touches the vectors; it lives alongside the triple so the knowledge can be
        audited.
      </p>
      <p>
        Before anything is stored it passes an AI <Term>fact-checker</Term>, and
        the gate is deliberately conservative. A claim the checker is confident is
        <em> false</em> is rejected outright. Only a confident <em>true</em> is
        trusted straight into the active brain. Anything <em>uncertain</em> -
        whether the model itself was unsure or the checker was unreachable - is
        held back as <Mono>disputed</Mono>: it is recorded, but it does{" "}
        <strong>not</strong> feed recall until an admin approves it. So the
        contradiction-resolution layer is <em>fail-closed</em> for trust (junk
        never silently enters recall) while still <em>fail-open</em> for
        availability (nothing is ever lost or hard-blocked).
      </p>
      <p>
        Worth being precise about: this checker only ever <em>guards what gets
        written</em>. It never produces an answer. Every recall the brain returns
        is still pure vector algebra over the hypervectors - there is no language
        model anywhere in the answer path. hiperbrain is not an LLM; it merely
        uses one as an optional gatekeeper at the door.
      </p>
      <p>
        The interesting case is <Term>contradiction</Term>. Some relations are{" "}
        <em>single-valued</em>: a country has exactly one capital. If someone
        teaches &ldquo;the capital of France is Lyon&rdquo; while the brain already
        holds Paris, the two cannot both be true. Rather than silently averaging
        them into a corrupted vector, hiperbrain asks the checker to{" "}
        <Term>adjudicate</Term> which value is correct:
      </p>
      <ul className="mt-2 space-y-2">
        <li>
          <Term>New wins</Term> — the new value becomes active and the old one is
          marked <Mono>superseded</Mono> (the brain changed its mind).
        </li>
        <li>
          <Term>Existing wins</Term> — the established value stays; the new claim
          is recorded as <Mono>superseded</Mono> for the record.
        </li>
        <li>
          <Term>Uncertain</Term> — the established value is kept active and the new
          claim is logged as <Mono>disputed</Mono>, so a single unverified
          submission can never knock a good answer out of recall.
        </li>
      </ul>
      <p className="mt-4">
        Crucially, <Term>only active facts feed the brain&apos;s math</Term>.
        Superseded and disputed claims are preserved for the{" "}
        <Mono>/logs</Mono> conflict view but never pollute a relation&apos;s
        bundled memory. Multi-valued relations (languages spoken, neighbours,
        members) skip adjudication entirely - a second value there is an addition,
        not a conflict.
      </p>
    </>
  ),

  benchmark: (
    <>
      <p>
        Bold claims deserve a number. The{" "}
        <Mono>
          <a href="/benchmark">/benchmark</a>
        </Mono>{" "}
        page runs a fixed set of known-answer questions against the live brain, in
        your browser, every time you open it - nothing is precomputed or
        cherry-picked.
      </p>
      <p>
        Because an associative memory should <em>abstain</em> rather than guess,
        the headline metric is not just accuracy. We report three honest numbers:
      </p>
      <ul className="mt-2 space-y-2">
        <li>
          <Term>Accuracy</Term> — correct answers over all questions.
        </li>
        <li>
          <Term>Precision</Term> — correct answers over the questions it answered{" "}
          <em>confidently</em> (using the calibrated sigma threshold).
        </li>
        <li>
          <Term>Confident-wrong</Term> — the HDC analogue of hallucination: how
          often it was confident <em>and</em> wrong. A well-calibrated brain keeps
          this near zero by saying &ldquo;I don&apos;t know&rdquo; on what it
          hasn&apos;t learned.
        </li>
      </ul>
      <p className="mt-4">
        That last number is the point: unlike a language model, hiperbrain does not
        fabricate a plausible answer under pressure. When the signal is weak it
        abstains, and the benchmark makes that behaviour measurable instead of a
        marketing claim.
      </p>
    </>
  ),
};

export function DocsView() {
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    [SECTIONS[0].id]: true,
  }));
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const toggle = useCallback((id: string) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }, []);

  const expandAll = useCallback(() => {
    setOpen(Object.fromEntries(SECTIONS.map((s) => [s.id, true])));
  }, []);

  const collapseAll = useCallback(() => {
    setOpen({});
  }, []);

  const goTo = useCallback((id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    requestAnimationFrame(() => {
      refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    for (const s of SECTIONS) {
      const el = refs.current[s.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const register = (id: string) => (el: HTMLElement | null) => {
    refs.current[id] = el;
  };

  const mobileTocRef = useRef<HTMLDetailsElement>(null);
  const handleNav = useCallback(
    (id: string) => {
      goTo(id);
      if (mobileTocRef.current) mobileTocRef.current.open = false;
    },
    [goTo],
  );

  const tocButtons = (
    <nav className="flex flex-col gap-0.5">
      {SECTIONS.map((s, i) => {
        const isActive = active === s.id;
        const newGroup = i === 0 || SECTIONS[i - 1].group !== s.group;
        return (
          <Fragment key={s.id}>
            {newGroup ? (
              <div className="px-2.5 pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted/50 first:pt-0">
                {s.group}
              </div>
            ) : null}
            <button
              onClick={() => handleNav(s.id)}
              className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                isActive ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span className="mt-0.5 font-mono text-[10px] text-accent">{pad(i + 1)}</span>
              <span className="leading-snug">{s.title}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );

  const expandCollapse = (
    <div className="mb-4 flex gap-2">
      <button
        onClick={expandAll}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground"
      >
        Expand all
      </button>
      <button
        onClick={collapseAll}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground"
      >
        Collapse all
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          hiperbrain documentation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          A brain that computes with 10,000-dimensional vectors
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Almost everything labelled &quot;AI&quot; today is one of two things: a
          giant neural network that is powerful but an opaque black box, or
          old-school symbolic logic that is transparent but brittle. hiperbrain is
          built on a long-overlooked{" "}
          <strong className="text-foreground">third path</strong> -{" "}
          <strong className="text-foreground">
            Hyperdimensional Computing (HDC)
          </strong>
          , also called Vector Symbolic Architectures. It is transparent like logic,
          robust like a neural net, and it does something neither of them does
          gracefully: it <em>thinks in pure algebra</em>.
        </p>
        <Callout>
          Every concept becomes a vector of <Mono>10,000</Mono> numbers. Learning a
          fact is one addition. Answering a question - even an analogy it was never
          explicitly taught - is a multiplication. Destroy a third of the numbers and
          it still remembers. And it all runs on a normal CPU, right in this browser.
        </Callout>
      </header>

      <div className="mt-10 grid gap-10 sm:mt-12 lg:grid-cols-[240px_1fr]">
        {/* Mobile / tablet: collapsible table of contents, sticky under the header */}
        <details
          ref={mobileTocRef}
          className="group sticky top-16 z-20 -mx-4 border-y border-border bg-background/90 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border lg:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground">
            <span>On this page</span>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="max-h-[60vh] overflow-y-auto border-t border-border px-2 py-2">
            {expandCollapse}
            {tocButtons}
          </div>
        </details>

        {/* Desktop: persistent sticky sidebar */}
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          {expandCollapse}
          {tocButtons}
        </aside>

        <div className="min-w-0">
          {SECTIONS.map((s, i) => {
            const newGroup = i === 0 || SECTIONS[i - 1].group !== s.group;
            return (
              <Fragment key={s.id}>
                {newGroup ? (
                  <h2 className="mt-12 mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent first:mt-0">
                    {s.group}
                  </h2>
                ) : null}
                <Accordion
                  n={i + 1}
                  meta={s}
                  open={open}
                  toggle={toggle}
                  register={register}
                >
                  {CONTENT[s.id]}
                </Accordion>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Accordion({
  n,
  meta,
  open,
  toggle,
  register,
  children,
}: {
  n: number;
  meta: SectionMeta;
  open: Record<string, boolean>;
  toggle: (id: string) => void;
  register: (id: string) => (el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const isOpen = !!open[meta.id];
  return (
    <section
      id={meta.id}
      ref={register(meta.id)}
      className="scroll-mt-24 border-b border-border/60"
    >
      <button
        onClick={() => toggle(meta.id)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 py-4 text-left"
      >
        <span className="font-mono text-xs text-accent">{pad(n)}</span>
        <span className="flex-1 text-lg font-semibold tracking-tight text-foreground">
          {meta.title}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-300 ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pb-6 leading-relaxed text-muted">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-5 text-base leading-relaxed text-foreground">
      {children}
    </div>
  );
}

function Compare({
  heading,
  points,
  tone,
}: {
  heading: string;
  points: string[];
  tone: "muted" | "accent";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "accent" ? "border-accent/40 bg-accent/5" : "border-border bg-surface/40"
      }`}
    >
      <div
        className={`text-sm font-semibold ${tone === "accent" ? "text-accent" : "text-foreground"}`}
      >
        {heading}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className={tone === "accent" ? "text-accent" : "text-muted/60"}>-</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 p-4">
      <div className="font-medium text-foreground">{q}</div>
      <p className="mt-1.5 text-sm text-muted">{a}</p>
    </div>
  );
}

function GlossaryItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-accent/40 pl-3">
      <dt className="font-medium text-foreground">{term}</dt>
      <dd className="text-sm text-muted">{children}</dd>
    </div>
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
