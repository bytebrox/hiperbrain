/**
 * Reversible encryption for API keys stored at rest.
 *
 * The credit-spend path only needs the SHA-256 hash of a key, so historically
 * we stored nothing else. To let a wallet owner *re-view* their keys in the
 * dashboard, we additionally keep each key encrypted with a server-side secret
 * (`API_KEY_ENC_SECRET`) using AES-256-GCM. The secret never leaves the server,
 * so a database leak alone does not expose any key.
 *
 * Stored format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 *
 * If `API_KEY_ENC_SECRET` is not configured (e.g. local dev), keys are stored
 * in plaintext as a fallback so the flow still works; `decryptKey` transparently
 * handles both forms.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "v1:";

function secretKey(): Buffer | null {
  const secret = process.env.API_KEY_ENC_SECRET;
  if (!secret) return null;
  // Derive a fixed 32-byte key from whatever secret length is configured.
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a key for storage. Falls back to plaintext when no secret is set. */
export function encryptKey(plaintext: string): string {
  const key = secretKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/**
 * Decrypt a stored key. Returns null if it was encrypted with a secret that is
 * no longer available (or the value is corrupt). Plaintext values (no prefix)
 * are returned as-is.
 */
export function decryptKey(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // plaintext fallback
  const key = secretKey();
  if (!key) return null; // encrypted, but we lost the secret
  try {
    const [, ivB64, tagB64, ctB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ct = Buffer.from(ctB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
