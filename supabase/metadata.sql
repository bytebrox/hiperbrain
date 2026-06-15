-- hiperbrain: fact metadata + contradiction tracking (additive migration).
--
-- Run this ONCE in the Supabase SQL editor, after supabase/schema.sql. It is
-- fully additive and backward compatible: existing rows keep their data and
-- receive sensible defaults (status='active', source='community'). Nothing is
-- dropped or rewritten.
--
-- What it adds:
--  * Provenance: where a fact came from and who taught it.
--  * A fact-checker verdict + a numeric confidence.
--  * A status so contradicting facts can be superseded/disputed instead of
--    silently corrupting recall. Only `active` facts feed the brain's math.
--  * A fast lookup key for "is there already an active value for this
--    subject + relation?" used by the contradiction adjudication.

-- --- Provenance + status ---------------------------------------------------
alter table public.facts
  add column if not exists status text not null default 'active';
alter table public.facts
  add column if not exists source text not null default 'community';
alter table public.facts
  add column if not exists owner text;
alter table public.facts
  add column if not exists verdict text;
alter table public.facts
  add column if not exists confidence real;
-- When a fact is superseded by a contradicting, better-rated one, this points
-- at the winner so the conflict can be shown in the activity log.
alter table public.facts
  add column if not exists superseded_by bigint references public.facts(id);
-- Short human-readable reason a fact was superseded/disputed (the adjudicator's verdict).
alter table public.facts
  add column if not exists note text;

-- Keep the allowed status values honest.
do $$ begin
  alter table public.facts
    add constraint facts_status_chk check (status in ('active', 'superseded', 'disputed'));
exception when duplicate_object then null;
end $$;

-- --- Subject+relation key for contradiction lookups ------------------------
-- Mirrors the lowercase normalisation used by the app. A partial index over
-- only the active rows makes "find the current value for subject+relation"
-- cheap even at hundreds of thousands of facts.
alter table public.facts
  add column if not exists sr_key text
  generated always as (lower(subject) || '|' || lower(relation)) stored;

create index if not exists facts_sr_active_idx
  on public.facts (sr_key)
  where status = 'active';

-- Listing/streaming reads filter by status, so index it too.
create index if not exists facts_status_created_idx
  on public.facts (status, created_at);

-- --- Realtime: ship full rows on UPDATE/DELETE -----------------------------
-- The browser brain listens to live changes and must drop a fact when it stops
-- being active (superseded/disputed) or is deleted. Without REPLICA IDENTITY
-- FULL, DELETE events only carry the primary key, so the client can't match the
-- row by (subject, relation, object). This makes the old row available too.
alter table public.facts replica identity full;
