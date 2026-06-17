/**
 * List or revoke the API keys of a wallet — the dashboard's key manager.
 *
 *   POST   /api/credits/keys  { wallet, timestamp, signature }
 *     -> { keys: [{ id, key, label, createdAt, lastUsedAt }] }
 *
 *   DELETE /api/credits/keys  { wallet, timestamp, signature, id }
 *     -> { ok: true }
 *
 * Both require a fresh signature of the "manage API keys" message, proving the
 * caller controls the wallet. The same signature is reusable for listing and
 * revoking within the freshness window, so the user signs once to manage keys.
 */

import { NextResponse } from "next/server";
import { listApiKeys, revokeApiKey } from "@/lib/server/credits";
import {
  isFreshTimestamp,
  manageKeysMessage,
  verifyWalletSignature,
} from "@/lib/server/verify-signature";

export const dynamic = "force-dynamic";

interface AuthedBody {
  wallet?: unknown;
  timestamp?: unknown;
  signature?: unknown;
}

/** Verify the manage-keys signature; returns the wallet or an error response. */
function authorize(body: AuthedBody): { wallet: string } | NextResponse {
  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const timestamp = body.timestamp;

  if (!wallet || !signature) {
    return NextResponse.json({ error: "Wallet and signature are required." }, { status: 400 });
  }
  if (!isFreshTimestamp(timestamp)) {
    return NextResponse.json({ error: "The signed message has expired. Try again." }, { status: 400 });
  }
  if (!verifyWalletSignature(wallet, manageKeysMessage(timestamp), signature)) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }
  return { wallet };
}

export async function POST(request: Request) {
  let body: AuthedBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const auth = authorize(body);
  if (auth instanceof NextResponse) return auth;

  const keys = await listApiKeys(auth.wallet);
  return NextResponse.json({ keys });
}

export async function DELETE(request: Request) {
  let body: AuthedBody & { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const auth = authorize(body);
  if (auth instanceof NextResponse) return auth;

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "A key id is required." }, { status: 400 });
  }

  const removed = await revokeApiKey(auth.wallet, id);
  if (!removed) {
    return NextResponse.json({ error: "Key not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
