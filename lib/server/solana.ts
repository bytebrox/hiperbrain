/**
 * Solana helpers for the burn-to-credits flow.
 *
 *  - `buildBurnTransaction` assembles an *unsigned* burn transaction so the
 *    browser only has to ask the wallet to sign it (all RPC stays server-side,
 *    the Helius key never reaches the client).
 *  - `verifyBurn` confirms that a given signature is a finalized transaction
 *    that burned our token mint, and reports who burned how much.
 *
 * The token mint is read from NEXT_PUBLIC_TOKEN_MINT (a mint address is public
 * on-chain, so the same value is safely used on the client and the server).
 * Until the token is launched the env holds a placeholder, so
 * `isTokenConfigured()` reports false and every entry point fails closed.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

const MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? "";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function getRpcUrl(): string | null {
  const key = process.env.HELIUS_API_KEY;
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : null;
}

/** True once a real Helius key and a valid base58 mint are configured. */
export function isTokenConfigured(): boolean {
  return Boolean(getRpcUrl()) && BASE58.test(MINT);
}

let connection: Connection | null = null;
function getConnection(): Connection | null {
  const url = getRpcUrl();
  if (!url) return null;
  if (!connection) connection = new Connection(url, "confirmed");
  return connection;
}

/**
 * Resolve which token program owns the mint. pump.fun and many newer mints use
 * Token-2022, while older tokens use the classic SPL Token program. The mint
 * account's owner *is* the program id, so we can support both transparently.
 */
async function getTokenProgramId(conn: Connection, mintPk: PublicKey): Promise<PublicKey> {
  const info = await conn.getAccountInfo(mintPk);
  if (!info) throw new Error("Mint account not found.");
  return info.owner;
}

/**
 * Build an unsigned burnChecked transaction the wallet can sign and send.
 * Returns a base64-encoded transaction, or null if the token isn't configured.
 */
export async function buildBurnTransaction(
  owner: string,
  uiAmount: number,
): Promise<string | null> {
  const conn = getConnection();
  if (!conn || !isTokenConfigured()) return null;
  if (!BASE58.test(owner) || !(uiAmount > 0)) return null;

  const ownerPk = new PublicKey(owner);
  const mintPk = new PublicKey(MINT);
  const programId = await getTokenProgramId(conn, mintPk);
  const mint = await getMint(conn, mintPk, undefined, programId);
  const rawAmount = BigInt(Math.round(uiAmount * 10 ** mint.decimals));
  if (rawAmount <= BigInt(0)) return null;

  const ata = await getAssociatedTokenAddress(mintPk, ownerPk, false, programId);
  const ix = createBurnCheckedInstruction(
    ata,
    mintPk,
    ownerPk,
    rawAmount,
    mint.decimals,
    [],
    programId,
  );

  const { blockhash } = await conn.getLatestBlockhash("finalized");
  const tx = new Transaction().add(ix);
  tx.feePayer = ownerPk;
  tx.recentBlockhash = blockhash;
  return tx.serialize({ requireAllSignatures: false }).toString("base64");
}

export interface BurnInfo {
  /** The authority (wallet) that burned the tokens. */
  wallet: string;
  /** Whole-token amount burned of our mint. */
  tokens: number;
}

function decimalsFromTx(tx: ParsedTransactionWithMeta): number {
  const all = [
    ...(tx.meta?.preTokenBalances ?? []),
    ...(tx.meta?.postTokenBalances ?? []),
  ];
  return all.find((b) => b.mint === MINT)?.uiTokenAmount.decimals ?? 0;
}

/**
 * Verify that `signature` finalized successfully and burned our mint. Returns
 * the burner and the whole-token amount, or null if no valid burn is found.
 */
export async function verifyBurn(signature: string): Promise<BurnInfo | null> {
  const conn = getConnection();
  if (!conn || !isTokenConfigured()) return null;

  // The wallet returns a signature as soon as the burn is submitted, but it can
  // take a few seconds to be queryable (and ~13s to finalize). "confirmed" is
  // reached within ~1-2s and is safe for crediting; retry briefly until the
  // transaction is visible.
  let tx: ParsedTransactionWithMeta | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      tx = await conn.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
    } catch {
      tx = null;
    }
    if (tx) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!tx || tx.meta?.err) return null;

  const decimals = decimalsFromTx(tx);
  let uiTokens = 0;
  let authority: string | null = null;

  const instructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions?.flatMap((i) => i.instructions) ?? []),
  ];

  for (const ix of instructions) {
    const program = (ix as { program?: string }).program;
    if (!("parsed" in ix) || (program !== "spl-token" && program !== "spl-token-2022")) {
      continue;
    }
    const parsed = (ix as { parsed?: { type?: string; info?: Record<string, unknown> } }).parsed;
    if (!parsed || (parsed.type !== "burn" && parsed.type !== "burnChecked")) continue;

    const info = parsed.info ?? {};
    if (info.mint !== MINT) continue;

    if (parsed.type === "burnChecked") {
      const ta = info.tokenAmount as { uiAmount?: number; amount?: string; decimals?: number };
      uiTokens +=
        ta.uiAmount ?? Number(ta.amount ?? 0) / 10 ** (ta.decimals ?? decimals);
    } else {
      uiTokens += Number(info.amount ?? 0) / 10 ** decimals;
    }
    authority =
      (info.authority as string) ?? (info.multisigAuthority as string) ?? authority;
  }

  if (uiTokens <= 0 || !authority) return null;
  return { wallet: authority, tokens: uiTokens };
}
