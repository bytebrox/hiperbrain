-- Haiperbrain database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor (or via the Supabase CLI).
--
-- Design notes:
--  * `facts` holds the shared knowledge as plain text triples. A generated
--    `fact_key` column enforces case-insensitive de-duplication.
--  * Row Level Security allows anyone to READ facts (so the browser can load
--    and live-subscribe), but only the service role (our server) can WRITE.
--  * `rate_events` is server-only and backs per-IP write rate limiting.

-- ---------------------------------------------------------------------------
-- Facts: the collective brain's knowledge
-- ---------------------------------------------------------------------------
create table if not exists public.facts (
  id          bigint generated always as identity primary key,
  subject     text not null,
  relation    text not null,
  object      text not null,
  fact_key    text generated always as (
                lower(subject) || '|' || lower(relation) || '|' || lower(object)
              ) stored,
  created_at  timestamptz not null default now(),
  unique (fact_key)
);

create index if not exists facts_created_at_idx on public.facts (created_at);

alter table public.facts enable row level security;

-- Public read access (anon + authenticated). No write policy is defined, so
-- inserts/updates/deletes are only possible with the service role key.
drop policy if exists "facts public read" on public.facts;
create policy "facts public read" on public.facts
  for select using (true);

-- Stream new facts to subscribed clients in real time.
alter publication supabase_realtime add table public.facts;

-- ---------------------------------------------------------------------------
-- Rate limiting: server-only log of write attempts per IP
-- ---------------------------------------------------------------------------
create table if not exists public.rate_events (
  id          bigint generated always as identity primary key,
  ip          text not null,
  created_at  timestamptz not null default now()
);

create index if not exists rate_events_ip_idx on public.rate_events (ip, created_at);

alter table public.rate_events enable row level security;
-- No policies: only the service role (which bypasses RLS) can touch this table.
