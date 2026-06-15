/**
 * Admin: moderate a single fact.
 *
 *   DELETE /api/admin/facts/:id           -> permanently delete it
 *   PATCH  /api/admin/facts/:id { status } -> change its status (e.g. approve a
 *                                            held fact by setting it `active`)
 *
 * Requires a valid admin session cookie. Invalidates the read cache so the
 * change shows up everywhere on the next poll.
 */

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/server/admin";
import { type FactStatus, getStore, invalidateFactsCache } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const STATUSES: FactStatus[] = ["active", "superseded", "disputed"];

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const numericId = parseId(id);
  if (numericId === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const removed = await getStore().deleteFact(numericId);
    if (removed) invalidateFactsCache();
    return NextResponse.json({ ok: removed });
  } catch {
    return NextResponse.json({ error: "Could not delete the fact." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const numericId = parseId(id);
  if (numericId === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const status = (body as { status?: unknown }).status;
  if (typeof status !== "string" || !STATUSES.includes(status as FactStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const store = getStore();
    // Approving runs the smart path (auto-supersedes a conflicting active value
    // for functional relations); other status changes are a plain update.
    const ok =
      status === "active"
        ? await store.approve(numericId)
        : await store.setStatus(numericId, status as FactStatus);
    if (ok) invalidateFactsCache();
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ error: "Could not update the fact." }, { status: 500 });
  }
}
