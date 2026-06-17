/**
 * Credit ledger: the off-chain accounting layer on top of on-chain token burns.
 *
 * Flow:
 *   burn tokens  -> redeemBurn(signature)  -> credits granted to the wallet
 *   sign message -> issueApiKey(wallet)    -> a key bound to that wallet
 *   API request  -> spendCredits(key,cost) -> atomically debit, or reject (402)
 *
 * All state lives in Supabase (see supabase/credits.sql). Keys are stored only
 * as SHA-256 hashes; the plaintext key is shown to the user exactly once.
 */

import { createHash, randomBytes } from "node:crypto";
import { getServiceClient } from "./supabase";
import { verifyBurn } from "./solana";
import { decryptKey, encryptKey } from "./key-crypto";

const CREDITS_PER_TOKEN = Number(process.env.CREDITS_PER_TOKEN ?? "1");
export const COST_ASK = Number(process.env.CREDITS_COST_ASK ?? "1");
export const COST_TEACH = Number(process.env.CREDITS_COST_TEACH ?? "10");

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Pull a `Bearer <key>` token out of the Authorization header. */
export function bearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export interface RedeemResult {
  ok: boolean;
  credited: number;
  tokens?: number;
  wallet?: string;
  error?: string;
}

/** Verify a burn transaction and grant the matching credits (idempotent). */
export async function redeemBurn(signature: string): Promise<RedeemResult> {
  const client = getServiceClient();
  if (!client) return { ok: false, credited: 0, error: "Server is not configured." };

  const burn = await verifyBurn(signature);
  if (!burn) {
    return {
      ok: false,
      credited: 0,
      error:
        "No burn of the hiperbrain token was found in that transaction. If you just sent it, wait a few seconds and try again.",
    };
  }

  const credits = Math.floor(burn.tokens * CREDITS_PER_TOKEN);
  if (credits <= 0) {
    return { ok: false, credited: 0, error: "The burned amount is too small to grant credits." };
  }

  const { data, error } = await client.rpc("grant_credits", {
    p_signature: signature,
    p_wallet: burn.wallet,
    p_tokens: burn.tokens,
    p_credits: credits,
  });
  if (error) return { ok: false, credited: 0, error: "Could not record the redemption." };

  const granted = Number(data ?? 0);
  if (granted <= 0) {
    return { ok: false, credited: 0, error: "This transaction has already been redeemed." };
  }
  return { ok: true, credited: granted, tokens: burn.tokens, wallet: burn.wallet };
}

/** Mint a fresh API key for a wallet. Returns the plaintext key. */
export async function issueApiKey(wallet: string, label?: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  const key = `hb_live_${randomBytes(24).toString("hex")}`;
  const { error } = await client.from("api_keys").insert({
    key_hash: hashKey(key),
    wallet,
    label: label ?? null,
    key_enc: encryptKey(key),
  });
  return error ? null : key;
}

/** A key as shown in the dashboard. `key` is null for legacy un-encrypted keys. */
export interface ApiKeyRecord {
  /** Stable identifier for revoke calls (the key's SHA-256 hash). */
  id: string;
  /** The full plaintext key, or null if it cannot be recovered (legacy/lost secret). */
  key: string | null;
  label: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** Every API key for a wallet, with the plaintext recovered where possible. */
export async function listApiKeys(wallet: string): Promise<ApiKeyRecord[]> {
  const client = getServiceClient();
  if (!client) return [];
  const { data, error } = await client
    .from("api_keys")
    .select("key_hash, label, key_enc, created_at, last_used_at")
    .eq("wallet", wallet)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.key_hash as string,
    key: decryptKey(row.key_enc as string | null),
    label: (row.label as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  }));
}

/** Permanently revoke a key, scoped to its owning wallet. Returns true if one was removed. */
export async function revokeApiKey(wallet: string, id: string): Promise<boolean> {
  const client = getServiceClient();
  if (!client) return false;
  const { data, error } = await client
    .from("api_keys")
    .delete()
    .eq("wallet", wallet)
    .eq("key_hash", id)
    .select("key_hash");
  return !error && Array.isArray(data) && data.length > 0;
}

/** The wallet a key belongs to, or null if the key is unknown. */
export async function walletForKey(apiKey: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  const { data } = await client
    .from("api_keys")
    .select("wallet")
    .eq("key_hash", hashKey(apiKey))
    .maybeSingle();
  return (data?.wallet as string) ?? null;
}

/** Current credit balance for a key, or null if the key is unknown. */
export async function balanceForKey(apiKey: string): Promise<number | null> {
  const client = getServiceClient();
  if (!client) return null;
  const wallet = await walletForKey(apiKey);
  if (!wallet) return null;
  const { data } = await client
    .from("credits")
    .select("balance")
    .eq("wallet", wallet)
    .maybeSingle();
  return Number(data?.balance ?? 0);
}

/** Atomically spend `cost` credits. Returns remaining balance, or -1 if it can't. */
export async function spendCredits(apiKey: string, cost: number): Promise<number> {
  const client = getServiceClient();
  if (!client) return -1;
  const { data, error } = await client.rpc("spend_credits", {
    p_key_hash: hashKey(apiKey),
    p_cost: cost,
  });
  if (error) return -1;
  return Number(data ?? -1);
}

/** Refund credits to the key's wallet (used when a charged write is rejected). */
export async function refundCredits(apiKey: string, amount: number): Promise<void> {
  const client = getServiceClient();
  if (!client || amount <= 0) return;
  const wallet = await walletForKey(apiKey);
  if (!wallet) return;
  await client.rpc("add_balance", { p_wallet: wallet, p_amount: amount });
}
