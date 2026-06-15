/**
 * Admin session management.
 *
 *   GET    -> { enabled, authed }      (state for the dashboard shell)
 *   POST   -> { password }             (log in; sets the session cookie)
 *   DELETE -> log out (clears the cookie)
 */

import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE,
  isAdminAuthed,
  isAdminEnabled,
  verifyPassword,
} from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: isAdminEnabled(), authed: await isAdminAuthed() });
}

export async function POST(request: Request) {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: "Admin is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const token = verifyPassword(password);
  if (!token) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
