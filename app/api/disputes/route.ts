/**
 * Conflicts the brain has resolved.
 *
 *   GET /api/disputes -> recent facts that were superseded or left disputed by
 *                        the contradiction adjudication, with the value the
 *                        brain currently holds. Kept separate from /api/brain so
 *                        the cached fact snapshot the brain is built from stays
 *                        lean.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getStore();
    await store.ensureSeeded();
    const disputes = await store.listDisputes(30);
    return NextResponse.json(
      { disputes },
      {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ disputes: [] });
  }
}
