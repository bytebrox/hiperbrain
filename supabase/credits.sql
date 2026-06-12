-- hiperbrain — token credits schema
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Every table here is server-only: RLS is enabled with NO policies, so the
-- tables are reachable exclusively through the service-role key used by the
-- API routes. The browser (anon key) can never read or write them.
--
-- Economic model: users burn the hiperbrain SPL token on Solana. Each burn
-- transaction is verified on-chain and converted into off-chain "credits" that
-- meter the programmatic API (POST /api/v1/ask, /api/v1/teach). The website's
-- public brain stays free — credits only gate the SDK/API layer.
-- ---------------------------------------------------------------------------

-- Per-wallet credit balance.
create table if not exists public.credits (
  wallet      text primary key,
  balance     bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- One row per redeemed burn transaction. The signature is the primary key, so
-- a transaction can never be redeemed twice (replay protection).
create table if not exists public.credit_events (
  signature   text primary key,
  wallet      text not null,
  tokens      numeric not null,
  credits     bigint not null,
  created_at  timestamptz not null default now()
);

-- API keys. We only ever store the SHA-256 hash of a key, never the key itself.
create table if not exists public.api_keys (
  key_hash      text primary key,
  wallet        text not null,
  label         text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists api_keys_wallet_idx on public.api_keys (wallet);
create index if not exists credit_events_wallet_idx on public.credit_events (wallet);

alter table public.credits       enable row level security;
alter table public.credit_events enable row level security;
alter table public.api_keys      enable row level security;

-- ---------------------------------------------------------------------------
-- Atomic credit operations (run inside a single statement so concurrent calls
-- cannot double-spend or double-grant).
-- ---------------------------------------------------------------------------

-- Record a verified burn and grant credits. Returns the number of credits
-- granted, or 0 if this signature was already redeemed.
create or replace function public.grant_credits(
  p_signature text,
  p_wallet    text,
  p_tokens    numeric,
  p_credits   bigint
) returns bigint
language plpgsql
as $$
begin
  insert into public.credit_events (signature, wallet, tokens, credits)
  values (p_signature, p_wallet, p_tokens, p_credits);

  insert into public.credits (wallet, balance, updated_at)
  values (p_wallet, p_credits, now())
  on conflict (wallet)
  do update set balance = public.credits.balance + p_credits,
                updated_at = now();

  return p_credits;
exception when unique_violation then
  return 0; -- signature already redeemed
end;
$$;

-- Spend credits for an API key. Returns the remaining balance, or -1 if the key
-- is unknown or the balance is insufficient (in which case nothing is charged).
create or replace function public.spend_credits(
  p_key_hash text,
  p_cost     bigint
) returns bigint
language plpgsql
as $$
declare
  v_wallet  text;
  v_balance bigint;
begin
  select wallet into v_wallet from public.api_keys where key_hash = p_key_hash;
  if v_wallet is null then
    return -1;
  end if;

  update public.api_keys set last_used_at = now() where key_hash = p_key_hash;

  update public.credits
     set balance = balance - p_cost,
         updated_at = now()
   where wallet = v_wallet and balance >= p_cost
  returning balance into v_balance;

  if v_balance is null then
    return -1; -- insufficient credits
  end if;

  return v_balance;
end;
$$;

-- Add credits back to a wallet (used to refund a charge when a write turns out
-- to be a duplicate or the brain is full).
create or replace function public.add_balance(
  p_wallet text,
  p_amount bigint
) returns void
language sql
as $$
  update public.credits
     set balance = balance + p_amount, updated_at = now()
   where wallet = p_wallet;
$$;
