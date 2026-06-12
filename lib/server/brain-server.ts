/**
 * A server-side KnowledgeBrain for the metered API.
 *
 * On the website the brain is rebuilt in every visitor's browser. The API needs
 * to answer queries itself, so we build one brain per serverless instance and
 * cache it. It is rebuilt only when the fact count changes or the cache ages
 * out, keeping cold-start cost off the hot path.
 */

import { KnowledgeBrain } from "@hiperbrain/core";
import { getFactsCached } from "./store";

const TTL_MS = 60_000;

const globalForBrain = globalThis as unknown as {
  __hbBrain?: { brain: KnowledgeBrain; at: number; count: number };
};

export async function getServerBrain(): Promise<KnowledgeBrain> {
  const facts = await getFactsCached();
  const cached = globalForBrain.__hbBrain;
  if (cached && cached.count === facts.length && Date.now() - cached.at < TTL_MS) {
    return cached.brain;
  }
  const brain = KnowledgeBrain.fromFacts(facts);
  globalForBrain.__hbBrain = { brain, at: Date.now(), count: facts.length };
  return brain;
}
