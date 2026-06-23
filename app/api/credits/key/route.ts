/**
 * Issue an API key for a wallet, gated by a fresh signed message.
 *
 *   POST /api/credits/key  { wallet, timestamp, signature }
 *   -> { apiKey }
 *
 * The signature proves the caller controls the wallet's private key; the
 * timestamp must be recent so a captured signature cannot be replayed forever.
 * The key is stored encrypted at rest (see issueApiKey), so the owner can
 * re-view it later via /api/credits/keys instead of it being shown only once.
 */

import { NextResponse } from "next/server";
import { issueApiKey } from "@/lib/server/credits";
import {
  isFreshTimestamp,
  signInMessage,
  verifyWalletSignature,
} from "@/lib/server/verify-signature";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { wallet?: unknown; timestamp?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const timestamp = body.timestamp;

  if (!wallet || !signature) {
    return NextResponse.json({ error: "Wallet and signature are required." }, { status: 400 });
  }
  if (!isFreshTimestamp(timestamp)) {
    return NextResponse.json({ error: "The signed message has expired. Try again." }, { status: 400 });
  }
  if (!verifyWalletSignature(wallet, signInMessage(timestamp), signature)) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }

  const apiKey = await issueApiKey(wallet);
  if (!apiKey) {
    return NextResponse.json({ error: "Could not issue a key." }, { status: 500 });
  }
  return NextResponse.json({ apiKey });
}
