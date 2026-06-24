-- hiperbrain: fast live counters for the collective brain (additive migration).
--
-- Run this ONCE in the Supabase SQL editor, after supabase/schema.sql and
-- supabase/metadata.sql. It is fully additive: it only creates a read-only
-- function and changes no data.
--
-- Why: the homepage and activity-log headers show facts / concepts / relations.
-- Computing these in the app used to require building the entire brain in a
-- serverless function (downloading every fact, tens of seconds, 504s at scale).
-- This function counts everything in the database in a single round trip:
--   * facts     = active fact rows
--   * concepts  = distinct subjects + objects  (matches KnowledgeBrain.stats())
--   * relations = distinct relations
--
-- The app falls back to a cheap fact-only count if this function is missing, so
-- installing it is what restores the concept/relation counters.

create or replace function public.brain_stats()
returns table (facts bigint, concepts bigint, relations bigint)
language sql
stable
as $$
  with active as (
    select subject, relation, object
    from public.facts
    where status = 'active'
  )
  select
    (select count(*) from active) as facts,
    (select count(*) from (
       select subject from active
       union
       select object from active
     ) c) as concepts,
    (select count(distinct relation) from active) as relations;
$$;

-- Let the public roles call it too (it only reads counts, no row data leaks).
grant execute on function public.brain_stats() to anon, authenticated, service_role;
