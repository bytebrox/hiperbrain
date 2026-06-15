/**
 * Admin: list facts of any status with search + pagination.
 *
 *   GET /api/admin/facts?q=&status=all|active|superseded|disputed&page=0
 *   -> { rows, total, page, pageSize }
 *
 * Requires a valid admin session cookie.
 */

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/server/admin";
import { getStore, type FactStatus } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const STATUSES: (FactStatus | "all")[] = ["all", "active", "superseded", "disputed"];

export async function GET(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.slice(0, 100) ?? "";
  const statusParam = url.searchParams.get("status") ?? "all";
  const status = (STATUSES as string[]).includes(statusParam)
    ? (statusParam as FactStatus | "all")
    : "all";
  const page = Math.max(0, Number(url.searchParams.get("page") ?? "0") || 0);

  try {
    const store = getStore();
    await store.ensureSeeded();
    const { rows, total } = await store.listAll({
      query,
      status,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE });
  } catch {
    return NextResponse.json({ error: "Could not load facts." }, { status: 500 });
  }
}
