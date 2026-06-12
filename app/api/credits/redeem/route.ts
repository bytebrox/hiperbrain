/**
 * Redeem a burn transaction for credits.
 *
 *   POST /api/credits/redeem  { signature: string }
 *   -> { ok, credited, tokens, wallet }   on success
 *
 * Idempotent: a signature can only ever be redeemed once.
 */

import { NextResponse } from "next/server";
import { redeemBurn } from "@/lib/server/credits";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!signature) {
    return NextResponse.json({ error: "A transaction signature is required." }, { status: 400 });
  }

  const result = await redeemBurn(signature);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
