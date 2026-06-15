"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AdminFact {
  id: number;
  subject: string;
  relation: string;
  object: string;
  status: "active" | "superseded" | "disputed";
  source: string;
  owner: string | null;
  createdAt: number;
  sourceUrl: string | null;
  verifiedAt: number | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

type Phase = "loading" | "disabled" | "login" | "dashboard";
type StatusFilter = "all" | "active" | "superseded" | "disputed";

const FILTERS: StatusFilter[] = ["all", "active", "superseded", "disputed"];

export function AdminView() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<AdminFact[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loadingRows, setLoadingRows] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => setPhase(!d.enabled ? "disabled" : d.authed ? "dashboard" : "login"))
      .catch(() => setPhase("login"));
  }, []);

  const loadFacts = useCallback(
    async (p: number, q: string, s: StatusFilter) => {
      setLoadingRows(true);
      try {
        const params = new URLSearchParams({ page: String(p), status: s });
        if (q) params.set("q", q);
        const res = await fetch(`/api/admin/facts?${params.toString()}`);
        if (res.status === 401) {
          setPhase("login");
          return;
        }
        const d = await res.json();
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
        setPageSize(d.pageSize ?? 50);
      } catch {
        setRows([]);
      } finally {
        setLoadingRows(false);
      }
    },
    [],
  );

  // (Re)load whenever the dashboard is active and its query parameters change.
  // Debounced so typing in the search box doesn't hammer the API.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (phase !== "dashboard") return;
    const delay = firstLoad.current ? 0 : 250;
    firstLoad.current = false;
    const t = window.setTimeout(() => loadFacts(page, query, status), delay);
    return () => window.clearTimeout(t);
  }, [phase, page, query, status, loadFacts]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPassword("");
        firstLoad.current = true;
        setPhase("dashboard");
      } else {
        const d = await res.json().catch(() => ({}));
        setLoginError(d.error ?? "Login failed.");
      }
    } catch {
      setLoginError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
    setRows([]);
    setPage(0);
    setQuery("");
    setStatus("all");
    setPhase("login");
  }

  async function approve(id: number) {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/admin/facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (res.status === 401) {
        setPhase("login");
        return;
      }
      if (res.ok) {
        // If we're filtering by a non-active status, the row no longer belongs
        // in the list; otherwise just reflect the new status in place.
        if (status !== "all" && status !== "active") {
          setRows((prev) => prev.filter((r) => r.id !== id));
        } else {
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "active" } : r)));
        }
      }
    } catch {
      /* ignore */
    } finally {
      setApprovingId(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this fact permanently?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/facts/${id}`, { method: "DELETE" });
      if (res.status === 401) {
        setPhase("login");
        return;
      }
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return <Shell><p className="text-sm text-muted">Loading…</p></Shell>;
  }

  if (phase === "disabled") {
    return (
      <Shell>
        <p className="text-sm text-muted">
          The admin area is not configured. Set{" "}
          <code className="rounded-sm border border-border px-1 py-0.5 text-foreground">
            ADMIN_PASSWORD
          </code>{" "}
          in the environment to enable it.
        </p>
      </Shell>
    );
  }

  if (phase === "login") {
    return (
      <Shell>
        <form onSubmit={login} className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
          <label className="text-xs uppercase tracking-wider text-muted">Admin password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="rounded-sm border border-border bg-surface/70 px-3 py-2 text-foreground outline-none focus:border-accent/60"
          />
          {loginError ? <p className="text-sm text-negative">{loginError}</p> : null}
          <button
            type="submit"
            disabled={busy || password === ""}
            className="rounded-sm border border-accent/50 bg-accent/10 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent/20 disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </Shell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {total.toLocaleString()} fact{total === 1 ? "" : "s"}
        </p>
        <button
          onClick={logout}
          className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-foreground"
        >
          Log out
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => {
            setPage(0);
            setQuery(e.target.value);
          }}
          placeholder="Search subject, relation or object…"
          className="w-full rounded-sm border border-border bg-surface/70 px-3 py-2 text-sm text-foreground outline-none focus:border-accent/60 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setPage(0);
                setStatus(f);
              }}
              className={`rounded-sm border px-2.5 py-1 font-mono text-xs uppercase tracking-wider transition-colors ${
                status === f
                  ? "border-accent/60 bg-accent/10 text-foreground"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border border-y border-border">
        {loadingRows && rows.length === 0 ? (
          <li className="py-4 text-sm text-muted">Loading…</li>
        ) : rows.length === 0 ? (
          <li className="py-4 text-sm text-muted">No facts match.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 font-mono text-sm">
                <div className="truncate">
                  <span className="text-muted">the </span>
                  {r.relation}
                  <span className="text-muted"> of </span>
                  {r.subject}
                  <span className="text-muted"> is </span>
                  <span className="text-accent">{r.object}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                  <StatusBadge status={r.status} />
                  <span>{r.source}</span>
                  {r.owner ? <span className="truncate">· {r.owner.slice(0, 8)}…</span> : null}
                  <span>· {new Date(r.createdAt).toLocaleDateString()}</span>
                  {r.verifiedAt ? (
                    <span className="text-positive/80" title={`verified ${new Date(r.verifiedAt).toLocaleString()}`}>
                      · verified
                    </span>
                  ) : null}
                  {r.sourceUrl ? (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="truncate text-accent transition-colors hover:underline"
                      title={r.sourceUrl}
                    >
                      · {hostOf(r.sourceUrl)} ↗
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {r.status !== "active" ? (
                  <button
                    onClick={() => approve(r.id)}
                    disabled={approvingId === r.id}
                    title="Approve: make this fact active and feed it into recall"
                    className="rounded-sm border border-positive/40 px-2.5 py-1 text-xs text-positive transition-colors hover:bg-positive/10 disabled:opacity-40"
                  >
                    {approvingId === r.id ? "Approving…" : "Approve"}
                  </button>
                ) : null}
                <button
                  onClick={() => remove(r.id)}
                  disabled={deletingId === r.id}
                  className="rounded-sm border border-negative/40 px-2.5 py-1 text-xs text-negative transition-colors hover:bg-negative/10 disabled:opacity-40"
                >
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
            disabled={page + 1 >= totalPages}
            className="rounded-sm border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted">Moderate and remove facts from the collective brain.</p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "superseded" | "disputed" }) {
  const tone =
    status === "active"
      ? "border-positive/40 text-positive"
      : status === "disputed"
        ? "border-border text-muted"
        : "border-accent/40 text-accent";
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
