/**
 * Persistence for the collective brain's facts.
 *
 * The shared knowledge is stored as small text triples, NOT as hypervectors:
 * every visitor's browser rebuilds the brain from these facts locally, so the
 * actual HDC computation stays client-side while the knowledge is shared.
 *
 * Two backends are provided:
 *  - SupabaseStore: hosted Postgres used in production. Also powers the
 *                   realtime stream that keeps every client's brain live.
 *  - MemoryStore  : an in-process fallback so the app runs with zero config in
 *                   local development. It resets when the server restarts.
 *
 * The backend is chosen automatically from the presence of Supabase env vars.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Fact } from "@hiperbrain/core";
import { factKey } from "./moderation";
import { getServiceClient, hasSupabase } from "./supabase";

/** Maximum number of facts the shared brain will hold. */
export const MAX_FACTS = 200000;

/**
 * Page size for reads. Kept at/below PostgREST's default `db-max-rows` (1000)
 * so a full page reliably signals "there may be more", letting us paginate
 * past the per-request row cap without changing any Supabase setting.
 */
const PAGE_SIZE = 500;

export type AddStatus = "added" | "duplicate" | "full";

/** A stored fact carries a creation timestamp for the activity log. */
export type StoredFact = Fact & { ts: number };

export interface AddResult {
  status: AddStatus;
  total: number;
}

export interface FactStore {
  ensureSeeded(): Promise<void>;
  listFacts(): Promise<StoredFact[]>;
  addFact(fact: Fact): Promise<AddResult>;
  count(): Promise<number>;
}

/** Starter knowledge so a first-time visitor sees a brain that already knows things. */
export const SEED_FACTS: Fact[] = [
  { subject: "France", relation: "capital", object: "Paris" },
  { subject: "Japan", relation: "capital", object: "Tokyo" },
  { subject: "Germany", relation: "capital", object: "Berlin" },
  { subject: "Egypt", relation: "capital", object: "Cairo" },
  { subject: "Canada", relation: "capital", object: "Ottawa" },
  { subject: "France", relation: "currency", object: "Euro" },
  { subject: "Japan", relation: "currency", object: "Yen" },
  { subject: "USA", relation: "currency", object: "Dollar" },
  { subject: "Mexico", relation: "currency", object: "Peso" },
  { subject: "India", relation: "currency", object: "Rupee" },
  { subject: "Dog", relation: "sound", object: "Woof" },
  { subject: "Cat", relation: "sound", object: "Meow" },
  { subject: "Cow", relation: "sound", object: "Moo" },
  { subject: "Duck", relation: "sound", object: "Quack" },
  { subject: "Sky", relation: "color", object: "Blue" },
  { subject: "Grass", relation: "color", object: "Green" },
  { subject: "Sun", relation: "color", object: "Yellow" },
  { subject: "Snow", relation: "color", object: "White" },
];

interface FactRow {
  subject: string;
  relation: string;
  object: string;
  created_at: string;
}

class SupabaseStore implements FactStore {
  constructor(private client: SupabaseClient) {}

  async ensureSeeded(): Promise<void> {
    if ((await this.count()) > 0) return;
    // ON CONFLICT DO NOTHING via the generated fact_key unique constraint.
    await this.client
      .from("facts")
      .upsert(SEED_FACTS, { onConflict: "fact_key", ignoreDuplicates: true });
  }

  async listFacts(): Promise<StoredFact[]> {
    const out: StoredFact[] = [];
    // Page through results so we are not limited by PostgREST's per-request
    // row cap. Stop at MAX_FACTS or when a short page signals the end.
    for (let from = 0; from < MAX_FACTS; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE, MAX_FACTS) - 1;
      const { data, error } = await this.client
        .from("facts")
        .select("subject,relation,object,created_at")
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) throw error;

      const rows = data as FactRow[];
      for (const row of rows) {
        out.push({
          subject: row.subject,
          relation: row.relation,
          object: row.object,
          ts: Date.parse(row.created_at),
        });
      }
      if (rows.length < to - from + 1) break; // last page reached
    }
    return out;
  }

  async count(): Promise<number> {
    const { count, error } = await this.client
      .from("facts")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }

  async addFact(fact: Fact): Promise<AddResult> {
    const total = await this.count();
    if (total >= MAX_FACTS) return { status: "full", total };

    const { error } = await this.client.from("facts").insert(fact);
    if (error) {
      // 23505 = unique_violation -> the fact already exists.
      if (error.code === "23505") return { status: "duplicate", total };
      throw error;
    }
    return { status: "added", total: total + 1 };
  }
}

class MemoryStore implements FactStore {
  private facts: StoredFact[] = [];
  private keys = new Set<string>();
  private seeded = false;

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    this.seeded = true;
    for (const fact of SEED_FACTS) await this.addFact(fact);
  }

  async listFacts(): Promise<StoredFact[]> {
    return [...this.facts];
  }

  async count(): Promise<number> {
    return this.facts.length;
  }

  async addFact(fact: Fact): Promise<AddResult> {
    if (this.facts.length >= MAX_FACTS) {
      return { status: "full", total: this.facts.length };
    }
    const key = factKey(fact);
    if (this.keys.has(key)) return { status: "duplicate", total: this.facts.length };
    this.keys.add(key);
    this.facts.push({ ...fact, ts: Date.now() });
    return { status: "added", total: this.facts.length };
  }
}

// Reuse a single store instance across hot reloads / serverless invocations.
const globalForStore = globalThis as unknown as { __hbStore?: FactStore };

export function getStore(): FactStore {
  if (!globalForStore.__hbStore) {
    const client = getServiceClient();
    globalForStore.__hbStore =
      hasSupabase() && client ? new SupabaseStore(client) : new MemoryStore();
  }
  return globalForStore.__hbStore;
}

/**
 * Short-lived in-process cache for the read path. Under high traffic this
 * collapses many concurrent page loads into a single database query per
 * instance per TTL. Clients stay fresh between windows via realtime updates.
 */
const READ_TTL_MS = 8000;
let factsCache: { facts: StoredFact[]; at: number } | null = null;

export async function getFactsCached(): Promise<StoredFact[]> {
  const store = getStore();
  await store.ensureSeeded();
  if (factsCache && Date.now() - factsCache.at < READ_TTL_MS) {
    return factsCache.facts;
  }
  const facts = await store.listFacts();
  factsCache = { facts, at: Date.now() };
  return facts;
}

export function invalidateFactsCache(): void {
  factsCache = null;
}
