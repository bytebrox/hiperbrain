/**
 * Paginated, searchable feed of active facts for the activity log.
 *
 *   GET /api/facts?q=&limit=50&offset=0  ->  { facts, total }
 *
 * The log used to download every fact and filter in the browser, which is fine
 * for a few thousand but ruinous at hundreds of thousands. Search and paging now
 * run in the database; the client only ever holds one page.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const store = getStore();
  await store.ensureSeeded();
  const { rows, total } = await store.listAll({ query, status: "active", limit, offset });

  const facts = rows.map((r) => ({
    subject: r.subject,
    relation: r.relation,
    object: r.object,
    ts: r.createdAt,
  }));

  return NextResponse.json(
    { facts, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
