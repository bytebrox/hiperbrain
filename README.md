# Haiperbrain

A **collective** brain that thinks in 10,000 dimensions - built on **Hyperdimensional Computing (HDC / Vector Symbolic Architectures)**.

Haiperbrain is **not** an LLM wrapper. It is a small, real, brain-inspired computing engine where every concept is a high-dimensional bipolar vector. Visitors **teach it facts** and **ask it questions**; the knowledge is shared with everyone, while the actual thinking happens live in each visitor's browser with plain CPU math. No GPU, no language model, no per-request API cost.

The whole experience is a single command line, search-engine style:

- **Ask** with `relation of subject` - e.g. `capital of France`.
- **Teach** with `relation of subject is object` - e.g. `capital of Spain is Madrid`.

A live, self-organising neural map shows the brain's current state, and the [`/logs`](app/logs/page.tsx) page streams everything it has ever been taught.

---

## How it works in one paragraph

Every concept (a word or short phrase) maps to a random vector with `D = 10,000` components of `-1` / `+1`. In such high-dimensional space, random vectors are almost always near-orthogonal, leaving effectively unlimited room for non-interfering concepts. Three reversible operations build everything: **bind** (`⊗`, associate two vectors), **bundle** (superimpose into a set), and **permute** (encode order). A fact `(subject, relation, object)` is stored by binding `subject ⊗ object` and bundling it into a per-relation memory vector. A question is answered by binding the known part back in and cleaning up the result against known concepts - the answer falls out of the algebra. Read the full explanation on the in-app `/how-it-works` page.

---

## The collective brain

- **Shared knowledge, local computation.** Facts are stored as tiny text triples in a database; each browser rebuilds the HDC brain from them and runs all vector math client-side.
- **Additive by nature.** Bundling is commutative and order-independent, so any number of contributors fold their facts into the same memory without coordination.
- **One-shot & instant.** "Learning" is a single superposition step - no training loop, no model download.
- **Graceful capacity.** Each relation's memory has finite capacity; as it fills, recall gets fuzzier, just like biological associative memory.

### Safety

Because the brain is public and writable, every submission is checked server-side before it joins the shared memory:

- input validation (length and character-set limits, low-information/nonsense rejection),
- a content blocklist filter,
- per-IP rate limiting (Postgres-backed sliding window),
- duplicate detection and a global capacity cap.

These live in [`lib/server/moderation.ts`](lib/server/moderation.ts) and [`lib/server/ratelimit.ts`](lib/server/ratelimit.ts) and are intentionally simple - extend them or plug in a dedicated moderation service for production.

---

## The HDC engine

Framework-agnostic TypeScript in [`lib/hdc/`](lib/hdc), with no runtime dependencies:

- [`hypervector.ts`](lib/hdc/hypervector.ts) - the bipolar hypervector type and primitives: `bind`, `bundle`, `permute`, `cosineSimilarity`, `corrupt`, plus deterministic seeded generation.
- [`itemMemory.ts`](lib/hdc/itemMemory.ts) - "cleanup memory" that maps a noisy vector back to the closest known symbol.
- [`knowledge.ts`](lib/hdc/knowledge.ts) - the collective `KnowledgeBrain`: learn/ask triples, bucketed per relation.
- [`encoders.ts`](lib/hdc/encoders.ts) and [`brain.ts`](lib/hdc/brain.ts) - a text encoder and a higher-level `Brain` with one-shot text classification, analogy and sequence memory (used by the test suite and available to build on).

### A taste of the API

```ts
import { KnowledgeBrain } from "@/lib/hdc";

const brain = new KnowledgeBrain();
brain.learn({ subject: "France", relation: "capital", object: "Paris" });
brain.learn({ subject: "Japan", relation: "capital", object: "Tokyo" });

brain.ask("France", "capital")[0].name; // "Paris"
```

---

## Architecture

```
Browser                          Server (Vercel)            Database
--------                         ----------------           --------
KnowledgeBrain (HDC math)  --->  GET  /api/brain     --->   Supabase Postgres
  rebuilt from facts             POST /api/brain             (text triples)
  all vector ops local           validate + rate limit
        ^                                                          |
        |____________ realtime INSERT stream (live) _______________|
```

- [`app/api/brain/route.ts`](app/api/brain/route.ts) - serves facts (briefly cached in-process) and accepts new ones.
- [`lib/server/store.ts`](lib/server/store.ts) - Supabase-backed store with an in-memory dev fallback and seed knowledge.
- [`lib/server/supabase.ts`](lib/server/supabase.ts) - server (service-role) Supabase client.
- [`lib/use-collective-brain.ts`](lib/use-collective-brain.ts) - client hook that loads facts, subscribes to live inserts, builds the brain and teaches new facts.

---

## Getting started

Requirements: Node.js 18.18+ (developed on Node 24).

```bash
npm install
npm run dev      # http://localhost:3000  (runs with an in-memory store, no config)
npm test         # run the HDC engine unit tests (Vitest)
npm run build    # production build
```

Locally the brain uses an in-memory store, so it works with zero configuration - it just is not shared between machines and resets on restart.

### Enabling the shared, realtime brain

1. Create a free project at [Supabase](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) (creates the `facts` table, RLS policies, the realtime stream and the rate-limit table).
3. Copy `.env.example` to `.env.local` and fill in the values from Project Settings -> API:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

4. Restart `npm run dev`. The brain is now backed by Postgres, shared, and updates live across all open tabs.

---

## Deployment (Vercel)

1. Push this repository to GitHub.
2. Import the repo in Vercel and accept the detected **Next.js** defaults.
3. Run [`supabase/schema.sql`](supabase/schema.sql) in your Supabase project.
4. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as Environment Variables.
5. Deploy.

Without the env vars the deployment still builds and runs, but each serverless instance keeps its own in-memory brain instead of a shared one.

---

## Project layout

```
app/
  page.tsx           home = the command line + live brain animation
  logs/              the activity feed of everything taught
  how-it-works/      a plain-language explainer
  api/brain/         GET facts + POST teach
components/
  brain/             home-hero, command-bar, brain-canvas (the animation)
  heatmap.tsx, site-header.tsx
lib/
  hdc/               the dependency-free HDC engine + unit tests
  server/            fact store, moderation and rate limiting
  parse-command.ts   single-line "ask vs teach" grammar
  use-collective-brain.ts
```

---

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- Tailwind CSS (no UI-kit dependency)
- [Supabase](https://supabase.com/) (Postgres + Realtime + Row Level Security) for the shared, live store
- [Vitest](https://vitest.dev/) for the engine tests

---

## Further reading

- Pentti Kanerva, *Hyperdimensional Computing: An Introduction to Computing in Distributed Representation with High-Dimensional Random Vectors* (2009).
- Pentti Kanerva, *Sparse Distributed Memory* (1988).
- Tony Plate, *Holographic Reduced Representations* (1995).

## License

MIT - see [`LICENSE`](LICENSE).
