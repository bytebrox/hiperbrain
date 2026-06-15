/**
 * Persistence for the collective brain's facts.
 *
 * The shared knowledge is stored as small text triples, NOT as hypervectors:
 * every visitor's browser rebuilds the brain from these facts locally, so the
 * actual HDC computation stays client-side while the knowledge is shared.
 *
 * Each fact also carries provenance and a status. Only `active` facts are
 * served to clients and folded into recall; `superseded` / `disputed` facts are
 * kept for the conflict view but never pollute the brain's vectors. This is how
 * contradictions on single-valued relations are resolved without corrupting the
 * collective memory.
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
import { isFunctional } from "./relations";
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
export type FactStatus = "active" | "superseded" | "disputed";
export type FactSource = "seed" | "community" | "api" | "import";

/** Provenance and resolution metadata attached at write time. */
export interface FactMeta {
  status?: FactStatus;
  source?: FactSource;
  owner?: string | null;
  verdict?: string | null;
  confidence?: number | null;
  note?: string | null;
  supersededBy?: number | null;
  /** Optional citation URL the fact came from. */
  sourceUrl?: string | null;
  /** Epoch ms when the fact was verified (set when the checker confirms it). */
  verifiedAt?: number | null;
}

/** A stored fact carries a creation timestamp and (when known) its row id/status. */
export type StoredFact = Fact & { ts: number; id?: number; status?: FactStatus };

export interface AddResult {
  status: AddStatus;
  total: number;
  /** Row id of the inserted fact (when the backend can report it). */
  id?: number;
}

/** The current active value for a subject+relation, used for contradiction checks. */
export interface ActiveValue {
  id: number;
  object: string;
}

/** A fact row as shown in the admin dashboard (all statuses, with provenance). */
export interface AdminFact {
  id: number;
  subject: string;
  relation: string;
  object: string;
  status: FactStatus;
  source: FactSource;
  owner: string | null;
  createdAt: number;
  sourceUrl: string | null;
  verifiedAt: number | null;
}

export interface AdminQuery {
  query?: string;
  status?: FactStatus | "all";
  limit: number;
  offset: number;
}

export interface AdminListResult {
  rows: AdminFact[];
  total: number;
}

/** A resolved or open conflict, for the activity log. */
export interface Dispute {
  subject: string;
  relation: string;
  /** The non-active (rejected/disputed) value. */
  losing: string;
  /** The current active value for the same subject+relation, if any. */
  winning: string | null;
  status: FactStatus;
  note: string | null;
  ts: number;
}

export interface FactStore {
  ensureSeeded(): Promise<void>;
  listFacts(): Promise<StoredFact[]>;
  addFact(fact: Fact, meta?: FactMeta): Promise<AddResult>;
  /** The active fact for a subject+relation, or null. */
  findActiveBySR(subject: string, relation: string): Promise<ActiveValue | null>;
  /** Mark a fact superseded by another (the winner of a contradiction). */
  supersede(id: number, byId: number): Promise<void>;
  /** Recent conflicts (non-active facts) for the activity log. */
  listDisputes(limit?: number): Promise<Dispute[]>;
  count(): Promise<number>;
  /** Admin: list facts of any status with search + pagination. */
  listAll(opts: AdminQuery): Promise<AdminListResult>;
  /** Admin: permanently delete a fact. Returns true if a row was removed. */
  deleteFact(id: number): Promise<boolean>;
  /** Admin: change a fact's status (e.g. demote a fact to disputed). */
  setStatus(id: number, status: FactStatus): Promise<boolean>;
  /**
   * Admin: approve a fact -> active. For single-valued (functional) relations
   * this also supersedes any other active value for the same subject+relation,
   * so approving never leaves two conflicting answers in recall.
   */
  approve(id: number): Promise<boolean>;
}

/** Strip characters that would break a PostgREST `or(...)` filter expression. */
function sanitizeSearch(query: string): string {
  return query.replace(/[%,()*]/g, "").trim();
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

function srKey(subject: string, relation: string): string {
  return `${subject.toLowerCase()}|${relation.toLowerCase()}`;
}

interface FactRow {
  id: number;
  subject: string;
  relation: string;
  object: string;
  status: FactStatus;
  created_at: string;
}

interface DisputeRow {
  subject: string;
  relation: string;
  object: string;
  status: FactStatus;
  note: string | null;
  created_at: string;
  sr_key: string;
}

class SupabaseStore implements FactStore {
  constructor(private client: SupabaseClient) {}

  async ensureSeeded(): Promise<void> {
    if ((await this.count()) > 0) return;
    // ON CONFLICT DO NOTHING via the generated fact_key unique constraint.
    await this.client
      .from("facts")
      .upsert(
        SEED_FACTS.map((f) => ({ ...f, source: "seed" })),
        { onConflict: "fact_key", ignoreDuplicates: true },
      );
  }

  async listFacts(): Promise<StoredFact[]> {
    const out: StoredFact[] = [];
    // Page through results so we are not limited by PostgREST's per-request
    // row cap. Stop at MAX_FACTS or when a short page signals the end. Only
    // active facts are served, so recall never sees superseded/disputed values.
    for (let from = 0; from < MAX_FACTS; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE, MAX_FACTS) - 1;
      const { data, error } = await this.client
        .from("facts")
        .select("id,subject,relation,object,status,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .range(from, to);
      if (error) throw error;

      const rows = data as FactRow[];
      for (const row of rows) {
        out.push({
          id: row.id,
          subject: row.subject,
          relation: row.relation,
          object: row.object,
          status: row.status,
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

  async addFact(fact: Fact, meta: FactMeta = {}): Promise<AddResult> {
    const total = await this.count();
    if (total >= MAX_FACTS) return { status: "full", total };

    const row = {
      ...fact,
      status: meta.status ?? "active",
      source: meta.source ?? "community",
      owner: meta.owner ?? null,
      verdict: meta.verdict ?? null,
      confidence: meta.confidence ?? null,
      note: meta.note ?? null,
      superseded_by: meta.supersededBy ?? null,
      source_url: meta.sourceUrl ?? null,
      verified_at: meta.verifiedAt ? new Date(meta.verifiedAt).toISOString() : null,
    };

    const { data, error } = await this.client
      .from("facts")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // 23505 = unique_violation -> the exact triple already exists.
      if (error.code === "23505") return { status: "duplicate", total };
      throw error;
    }
    return { status: "added", total: total + 1, id: data?.id as number };
  }

  async findActiveBySR(subject: string, relation: string): Promise<ActiveValue | null> {
    const { data, error } = await this.client
      .from("facts")
      .select("id,object")
      .eq("sr_key", srKey(subject, relation))
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id as number, object: data.object as string } : null;
  }

  async supersede(id: number, byId: number): Promise<void> {
    const { error } = await this.client
      .from("facts")
      .update({ status: "superseded", superseded_by: byId })
      .eq("id", id);
    if (error) throw error;
  }

  async listDisputes(limit = 20): Promise<Dispute[]> {
    const { data, error } = await this.client
      .from("facts")
      .select("subject,relation,object,status,note,created_at,sr_key")
      .neq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const rows = (data ?? []) as DisputeRow[];

    const keys = [...new Set(rows.map((r) => r.sr_key))];
    const winners = new Map<string, string>();
    if (keys.length > 0) {
      const { data: act } = await this.client
        .from("facts")
        .select("sr_key,object")
        .in("sr_key", keys)
        .eq("status", "active");
      for (const w of (act ?? []) as { sr_key: string; object: string }[]) {
        winners.set(w.sr_key, w.object);
      }
    }

    return rows.map((r) => ({
      subject: r.subject,
      relation: r.relation,
      losing: r.object,
      winning: winners.get(r.sr_key) ?? null,
      status: r.status,
      note: r.note,
      ts: Date.parse(r.created_at),
    }));
  }

  async listAll(opts: AdminQuery): Promise<AdminListResult> {
    let q = this.client
      .from("facts")
      .select("id,subject,relation,object,status,source,owner,created_at,source_url,verified_at", {
        count: "exact",
      });

    if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);

    const search = opts.query ? sanitizeSearch(opts.query) : "";
    if (search) {
      q = q.or(
        `subject.ilike.%${search}%,relation.ilike.%${search}%,object.ilike.%${search}%`,
      );
    }

    const { data, count, error } = await q
      .order("created_at", { ascending: false })
      .range(opts.offset, opts.offset + opts.limit - 1);
    if (error) throw error;

    const rows = ((data ?? []) as (FactRow & {
      source: FactSource;
      owner: string | null;
      source_url: string | null;
      verified_at: string | null;
    })[]).map((r) => ({
      id: r.id,
      subject: r.subject,
      relation: r.relation,
      object: r.object,
      status: r.status,
      source: r.source,
      owner: r.owner,
      createdAt: Date.parse(r.created_at),
      sourceUrl: r.source_url,
      verifiedAt: r.verified_at ? Date.parse(r.verified_at) : null,
    }));
    return { rows, total: count ?? rows.length };
  }

  async deleteFact(id: number): Promise<boolean> {
    // Clear any conflict links pointing at this row first, so the foreign key
    // (superseded_by) does not block the delete.
    await this.client.from("facts").update({ superseded_by: null }).eq("superseded_by", id);
    const { error, count } = await this.client
      .from("facts")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async setStatus(id: number, status: FactStatus): Promise<boolean> {
    // Activating a fact clears any "superseded by" link it may have carried.
    const patch: Record<string, unknown> = { status };
    if (status === "active") patch.superseded_by = null;
    const { error, count } = await this.client
      .from("facts")
      .update(patch, { count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async approve(id: number): Promise<boolean> {
    const { data, error } = await this.client
      .from("facts")
      .select("id,subject,relation")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;

    const { error: e2 } = await this.client
      .from("facts")
      .update({ status: "active", superseded_by: null })
      .eq("id", id);
    if (e2) throw e2;

    // Single-valued relation: demote any other active value for the same
    // subject+relation so recall is never left with two competing answers.
    if (isFunctional(data.relation as string)) {
      const { error: e3 } = await this.client
        .from("facts")
        .update({ status: "superseded", superseded_by: id })
        .eq("sr_key", srKey(data.subject as string, data.relation as string))
        .eq("status", "active")
        .neq("id", id);
      if (e3) throw e3;
    }
    return true;
  }
}

interface MemoryRow {
  id: number;
  subject: string;
  relation: string;
  object: string;
  status: FactStatus;
  source: FactSource;
  owner: string | null;
  verdict: string | null;
  confidence: number | null;
  note: string | null;
  supersededBy: number | null;
  sourceUrl: string | null;
  verifiedAt: number | null;
  ts: number;
}

export class MemoryStore implements FactStore {
  private rows: MemoryRow[] = [];
  private keys = new Set<string>();
  private nextId = 1;
  private seeded = false;

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    this.seeded = true;
    for (const fact of SEED_FACTS) await this.addFact(fact, { source: "seed" });
  }

  async listFacts(): Promise<StoredFact[]> {
    return this.rows
      .filter((r) => r.status === "active")
      .map((r) => ({
        id: r.id,
        subject: r.subject,
        relation: r.relation,
        object: r.object,
        status: r.status,
        ts: r.ts,
      }));
  }

  async count(): Promise<number> {
    return this.rows.length;
  }

  async addFact(fact: Fact, meta: FactMeta = {}): Promise<AddResult> {
    if (this.rows.length >= MAX_FACTS) {
      return { status: "full", total: this.rows.length };
    }
    const key = factKey(fact);
    if (this.keys.has(key)) return { status: "duplicate", total: this.rows.length };
    this.keys.add(key);
    const id = this.nextId++;
    this.rows.push({
      id,
      subject: fact.subject,
      relation: fact.relation,
      object: fact.object,
      status: meta.status ?? "active",
      source: meta.source ?? "community",
      owner: meta.owner ?? null,
      verdict: meta.verdict ?? null,
      confidence: meta.confidence ?? null,
      note: meta.note ?? null,
      supersededBy: meta.supersededBy ?? null,
      sourceUrl: meta.sourceUrl ?? null,
      verifiedAt: meta.verifiedAt ?? null,
      ts: Date.now(),
    });
    return { status: "added", total: this.rows.length, id };
  }

  async findActiveBySR(subject: string, relation: string): Promise<ActiveValue | null> {
    const want = srKey(subject, relation);
    const row = this.rows.find(
      (r) => r.status === "active" && srKey(r.subject, r.relation) === want,
    );
    return row ? { id: row.id, object: row.object } : null;
  }

  async supersede(id: number, byId: number): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) {
      row.status = "superseded";
      row.supersededBy = byId;
    }
  }

  async listDisputes(limit = 20): Promise<Dispute[]> {
    const active = new Map<string, string>();
    for (const r of this.rows) {
      if (r.status === "active") active.set(srKey(r.subject, r.relation), r.object);
    }
    return this.rows
      .filter((r) => r.status !== "active")
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit)
      .map((r) => ({
        subject: r.subject,
        relation: r.relation,
        losing: r.object,
        winning: active.get(srKey(r.subject, r.relation)) ?? null,
        status: r.status,
        note: r.note,
        ts: r.ts,
      }));
  }

  async listAll(opts: AdminQuery): Promise<AdminListResult> {
    const search = opts.query ? sanitizeSearch(opts.query).toLowerCase() : "";
    const filtered = this.rows
      .filter((r) => !opts.status || opts.status === "all" || r.status === opts.status)
      .filter((r) => {
        if (!search) return true;
        return (
          r.subject.toLowerCase().includes(search) ||
          r.relation.toLowerCase().includes(search) ||
          r.object.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.ts - a.ts);

    const rows = filtered.slice(opts.offset, opts.offset + opts.limit).map((r) => ({
      id: r.id,
      subject: r.subject,
      relation: r.relation,
      object: r.object,
      status: r.status,
      source: r.source,
      owner: r.owner,
      createdAt: r.ts,
      sourceUrl: r.sourceUrl,
      verifiedAt: r.verifiedAt,
    }));
    return { rows, total: filtered.length };
  }

  async deleteFact(id: number): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    const [removed] = this.rows.splice(idx, 1);
    this.keys.delete(factKey(removed));
    for (const r of this.rows) if (r.supersededBy === id) r.supersededBy = null;
    return true;
  }

  async setStatus(id: number, status: FactStatus): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return false;
    row.status = status;
    if (status === "active") row.supersededBy = null;
    return true;
  }

  async approve(id: number): Promise<boolean> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return false;
    row.status = "active";
    row.supersededBy = null;
    if (isFunctional(row.relation)) {
      const key = srKey(row.subject, row.relation);
      for (const r of this.rows) {
        if (r.id !== id && r.status === "active" && srKey(r.subject, r.relation) === key) {
          r.status = "superseded";
          r.supersededBy = id;
        }
      }
    }
    return true;
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
