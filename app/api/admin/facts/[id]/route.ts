/**
 * Admin: permanently delete a fact.
 *
 *   DELETE /api/admin/facts/:id
 *
 * Requires a valid admin session cookie. Invalidates the read cache so the
 * change shows up everywhere on the next poll.
 */

import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/server/admin";
import { getStore, invalidateFactsCache } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
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
