/**
 * Report the credit balance for an API key.
 *
 *   GET /api/credits/balance   (Authorization: Bearer <key>)
 *   -> { balance }
 */

import { NextResponse } from "next/server";
import { balanceForKey, bearerToken } from "@/lib/server/credits";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = bearerToken(request);
  if (!key) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401 });
  }
  const balance = await balanceForKey(key);
  if (balance === null) {
    return NextResponse.json({ error: "Unknown API key." }, { status: 401 });
  }
  return NextResponse.json({ balance });
}
