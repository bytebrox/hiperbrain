/**
 * Minimal single-admin authentication for the /admin dashboard.
 *
 * There is exactly one operator (the project owner), so a full user system would
 * be overkill. Instead:
 *   - The admin password lives in the server-only `ADMIN_PASSWORD` env var.
 *   - On login we derive an opaque session token (a hash of the password) and
 *     store it in an httpOnly, SameSite cookie. The plaintext password is never
 *     stored in the cookie and is never readable from JavaScript.
 *   - Every admin request recomputes the expected token and compares it in
 *     constant time.
 *
 * If `ADMIN_PASSWORD` is unset, the admin area is simply disabled.
 */

import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "hb_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function isAdminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** The opaque session token for the configured password, or null if disabled. */
export function sessionToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`${pw}:hiperbrain-admin-v1`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Validate a password attempt; returns the session token on success. */
export function verifyPassword(password: string): string | null {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return null;
  return safeEqual(password, expected) ? sessionToken() : null;
}

/** Whether the current request carries a valid admin session cookie. */
export async function isAdminAuthed(): Promise<boolean> {
  const expected = sessionToken();
  if (!expected) return false;
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  return Boolean(value && safeEqual(value, expected));
}
