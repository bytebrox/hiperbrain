/**
 * Build an unsigned burn transaction for the browser to sign.
 *
 *   POST /api/solana/prepare  { owner: string, amount: number }
 *   -> { transaction: base64 }   (an unsigned burnChecked transaction)
 *
 * All RPC happens here so the Helius key never reaches the client.
 */

import { NextResponse } from "next/server";
import { buildBurnTransaction, isTokenConfigured } from "@/lib/server/solana";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTokenConfigured()) {
    return NextResponse.json(
      { error: "The hiperbrain token is not configured yet." },
      { status: 503 },
    );
  }

  let body: { owner?: unknown; amount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const owner = typeof body.owner === "string" ? body.owner : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!owner || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Provide a wallet and a positive amount." }, { status: 400 });
  }

  try {
    const transaction = await buildBurnTransaction(owner, amount);
    if (!transaction) {
      return NextResponse.json({ error: "Could not build the transaction." }, { status: 400 });
    }
    return NextResponse.json({ transaction });
  } catch {
    return NextResponse.json(
      { error: "Could not build the transaction. Check the wallet holds the token." },
      { status: 400 },
    );
  }
}
