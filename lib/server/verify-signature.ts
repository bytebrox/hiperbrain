/**
 * Verify a Solana wallet "sign-in" signature.
 *
 * To mint an API key for a wallet we require proof that the requester controls
 * that wallet's private key: they sign a short message with a fresh timestamp,
 * and we verify the ed25519 signature against the wallet's public key.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";

/** Max age of the signed message, to limit replay of a captured signature. */
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

/** The exact message the wallet must sign to mint a key (must match the client). */
export function signInMessage(timestamp: number): string {
  return `hiperbrain: issue an API key for this wallet.\nts=${timestamp}`;
}

/**
 * The message a wallet signs to view or revoke its keys. A single signature is
 * reusable for listing, revoking and re-creating within the freshness window,
 * so the user signs once to "log in" to the key dashboard.
 */
export function manageKeysMessage(timestamp: number): string {
  return `hiperbrain: manage API keys for this wallet.\nts=${timestamp}`;
}

export function verifyWalletSignature(
  wallet: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pub = bs58.decode(wallet);
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

/** True if `ts` is a number within the allowed freshness window. */
export function isFreshTimestamp(ts: unknown): ts is number {
  return (
    typeof ts === "number" &&
    Number.isFinite(ts) &&
    Math.abs(Date.now() - ts) <= MAX_MESSAGE_AGE_MS
  );
}
