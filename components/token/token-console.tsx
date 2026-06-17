"use client";

import { useCallback, useRef, useState } from "react";
import { Transaction } from "@solana/web3.js";
import bs58 from "bs58";

/** Minimal shape of the Phantom-style injected provider we rely on. */
interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: "utf8" | "hex"): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(tx: Transaction): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
  }
}

/** A key as returned by GET-style /api/credits/keys. */
interface ApiKeyRecord {
  id: string;
  key: string | null;
  label: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** A reusable "manage keys" signature; valid server-side for 5 minutes. */
interface ManageAuth {
  wallet: string;
  timestamp: number;
  signature: string;
}

// Re-sign a little before the server's 5-minute freshness window expires.
const AUTH_TTL_MS = 4 * 60 * 1000;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function issueMessageText(ts: number): string {
  return `hiperbrain: issue an API key for this wallet.\nts=${ts}`;
}

function manageMessageText(ts: number): string {
  return `hiperbrain: manage API keys for this wallet.\nts=${ts}`;
}

type Note = { tone: "info" | "ok" | "err"; text: string } | null;

export function TokenConsole({ tokenConfigured }: { tokenConfigured: boolean }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [amount, setAmount] = useState("1000");
  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [sig, setSig] = useState("");

  // The manage-keys signature is kept in a ref so list/revoke/create can reuse
  // it within the freshness window — the user signs once to manage their keys.
  const authRef = useRef<ManageAuth | null>(null);

  const provider = (): SolanaProvider | null =>
    typeof window !== "undefined" && window.solana ? window.solana : null;

  const refreshBalance = useCallback(async (key: string) => {
    try {
      const res = await fetch("/api/credits/balance", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (res.ok) setBalance(Number(data.balance));
    } catch {
      /* ignore */
    }
  }, []);

  // Obtain a fresh "manage" signature, reusing the cached one when still valid.
  const ensureAuth = useCallback(async (): Promise<ManageAuth | null> => {
    const p = provider();
    if (!p || !wallet) return null;
    const cached = authRef.current;
    if (cached && cached.wallet === wallet && Date.now() - cached.timestamp < AUTH_TTL_MS) {
      return cached;
    }
    const ts = Date.now();
    const message = new TextEncoder().encode(manageMessageText(ts));
    const { signature } = await p.signMessage(message, "utf8");
    const auth: ManageAuth = { wallet, timestamp: ts, signature: bs58.encode(signature) };
    authRef.current = auth;
    return auth;
  }, [wallet]);

  // Fetch the wallet's keys and refresh the balance from the first usable key.
  const loadKeys = useCallback(
    async (auth: ManageAuth) => {
      const res = await fetch("/api/credits/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load keys.");
      const list = (data.keys as ApiKeyRecord[]) ?? [];
      setKeys(list);
      const usable = list.find((k) => k.key);
      if (usable?.key) void refreshBalance(usable.key);
      return list;
    },
    [refreshBalance],
  );

  const connect = async () => {
    const p = provider();
    if (!p) {
      setNote({ tone: "err", text: "No Solana wallet found. Install Phantom to continue." });
      return;
    }
    try {
      const { publicKey } = await p.connect();
      setWallet(publicKey.toString());
      setNote(null);
    } catch {
      setNote({ tone: "err", text: "Wallet connection was rejected." });
    }
  };

  // Sign once to "log in" to the key dashboard, then list the wallet's keys.
  const signInToManage = async () => {
    if (!wallet) return;
    setBusy("manage");
    try {
      const auth = await ensureAuth();
      if (!auth) throw new Error("Connect a wallet first.");
      await loadKeys(auth);
      setNote(null);
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Could not load keys." });
    } finally {
      setBusy(null);
    }
  };

  // Redeem a burn signature for credits. Idempotent server-side, so it is safe
  // to retry the same signature if a previous attempt failed or was too early.
  const redeemSignature = async (signature: string) => {
    if (!signature) return;
    setBusy("redeem");
    setNote({ tone: "info", text: "Confirming on-chain & crediting…" });
    try {
      const redeem = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const data = await redeem.json();
      if (!redeem.ok) throw new Error(data.error ?? "Redemption failed.");
      setNote({ tone: "ok", text: `Done. ${data.credited} credits added.` });
      setSig("");
      const usable = keys?.find((k) => k.key);
      if (usable?.key) void refreshBalance(usable.key);
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Redemption failed." });
    } finally {
      setBusy(null);
    }
  };

  const burn = async () => {
    const p = provider();
    if (!p || !wallet) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setNote({ tone: "err", text: "Enter a positive amount of tokens to burn." });
      return;
    }
    setBusy("burn");
    setNote({ tone: "info", text: "Building transaction…" });
    try {
      const prep = await fetch("/api/solana/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: wallet, amount: amt }),
      });
      const prepData = await prep.json();
      if (!prep.ok) throw new Error(prepData.error ?? "Could not build transaction.");

      const tx = Transaction.from(base64ToBytes(prepData.transaction));
      setNote({ tone: "info", text: "Approve the burn in your wallet…" });
      const { signature } = await p.signAndSendTransaction(tx);
      // Keep the signature so the burn can always be re-redeemed if anything
      // below fails — the tokens are already gone, the credits must follow.
      setSig(signature);

      await redeemSignature(signature);
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Burn failed." });
      setBusy(null);
    }
  };

  // Mint a new key. The key is now stored (encrypted) server-side, so it shows
  // up in the list below and stays re-viewable — no more "shown only once".
  const createKey = async () => {
    const p = provider();
    if (!p || !wallet) return;
    setBusy("key");
    try {
      const ts = Date.now();
      const message = new TextEncoder().encode(issueMessageText(ts));
      const { signature } = await p.signMessage(message, "utf8");
      const res = await fetch("/api/credits/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, timestamp: ts, signature: bs58.encode(signature) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not issue a key.");

      const auth = await ensureAuth();
      let list: ApiKeyRecord[] = [];
      if (auth) list = await loadKeys(auth);
      // Reveal the freshly created key so the user can copy it immediately.
      const created = list.find((k) => k.key === data.apiKey);
      if (created) setRevealed((prev) => new Set(prev).add(created.id));
      setNote({ tone: "ok", text: "API key created and saved to your wallet." });
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Could not issue a key." });
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (id: string) => {
    if (!wallet) return;
    setBusy(`del:${id}`);
    try {
      const auth = await ensureAuth();
      if (!auth) throw new Error("Connect a wallet first.");
      const res = await fetch("/api/credits/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete the key.");
      await loadKeys(auth);
      setNote({ tone: "ok", text: "Key revoked. It can no longer be used." });
    } catch (e) {
      setNote({ tone: "err", text: e instanceof Error ? e.message : "Could not delete the key." });
    } finally {
      setBusy(null);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {!tokenConfigured && (
        <div className="rounded-sm border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted">
          The hiperbrain token isn&apos;t live yet. The console below is fully wired —
          the moment the mint is set, burning starts granting real credits.
        </div>
      )}

      {note && (
        <div
          className={`rounded-sm border px-4 py-3 text-sm ${
            note.tone === "err"
              ? "border-negative/40 text-negative"
              : note.tone === "ok"
                ? "border-positive/40 text-positive"
                : "border-border text-muted"
          }`}
        >
          {note.text}
        </div>
      )}

      <Step n={1} title="Connect your wallet">
        {wallet ? (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-mono text-sm text-foreground">
              {wallet.slice(0, 6)}…{wallet.slice(-6)}
            </span>
            {balance !== null && (
              <span className="font-mono text-sm text-accent">{balance} credits</span>
            )}
          </div>
        ) : (
          <Button onClick={connect} className="w-full sm:w-auto">
            Connect Phantom
          </Button>
        )}
      </Step>

      <Step n={2} title="Burn tokens for credits">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Burning permanently removes tokens from supply and credits your wallet.
          {" "}
          <span className="text-foreground">1 token = 1 credit.</span> A credit buys one{" "}
          <code className="text-accent">ask</code>; a permanent, AI-verified{" "}
          <code className="text-accent">teach</code> costs 10.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent/60 sm:w-40"
          />
          <Button
            onClick={burn}
            disabled={!wallet || busy === "burn" || busy === "redeem"}
            className="w-full sm:w-auto"
          >
            {busy === "burn" ? "Working…" : "Burn & credit"}
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs leading-relaxed text-muted/80">
            Already burned but didn&apos;t get credited? Paste the transaction
            signature to redeem it — it&apos;s safe to retry, each burn can only
            be credited once.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              placeholder="transaction signature"
              spellCheck={false}
              className="w-full min-w-0 rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent/60 sm:flex-1"
            />
            <Button
              variant="ghost"
              onClick={() => redeemSignature(sig.trim())}
              disabled={!sig.trim() || busy === "redeem" || busy === "burn"}
              className="w-full sm:w-auto"
            >
              {busy === "redeem" ? "Redeeming…" : "Redeem"}
            </Button>
          </div>
        </div>
      </Step>

      <Step n={3} title="Your API keys">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Keys are saved to your wallet and spend its credits. Sign once to view
          them — reveal a key with the eye, copy it, revoke it, or create more.
        </p>

        {keys === null ? (
          <Button
            onClick={signInToManage}
            disabled={!wallet || busy === "manage"}
            className="w-full sm:w-auto"
          >
            {busy === "manage" ? "Signing…" : "Sign in to view keys"}
          </Button>
        ) : (
          <div className="space-y-3">
            {keys.length === 0 ? (
              <p className="text-sm text-muted">
                No keys yet. Create your first one below.
              </p>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <KeyRow
                    key={k.id}
                    record={k}
                    revealed={revealed.has(k.id)}
                    deleting={busy === `del:${k.id}`}
                    onToggle={() => toggleReveal(k.id)}
                    onCopy={() => k.key && navigator.clipboard.writeText(k.key)}
                    onDelete={() => deleteKey(k.id)}
                  />
                ))}
              </ul>
            )}
            <Button
              onClick={createKey}
              disabled={!wallet || busy === "key"}
              className="w-full sm:w-auto"
            >
              {busy === "key" ? "Signing…" : "Create new key"}
            </Button>
          </div>
        )}
      </Step>

      <Step n={4} title="Call the brain">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Reason over the live collective brain from anywhere:
        </p>
        <pre className="overflow-x-auto rounded-sm border border-border bg-surface px-4 py-3 font-mono text-xs leading-relaxed text-muted">
{`# Ask the brain a question — 1 credit
curl -X POST https://www.hiperbrain.com/api/v1/ask \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"France","relation":"capital"}'
# -> { "answer": "Paris", "confidence": {...}, "remaining": 999 }

# Teach the brain a new fact — 10 credits (AI-verified, permanent)
curl -X POST https://www.hiperbrain.com/api/v1/teach \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"Slovenia","relation":"capital","object":"Ljubljana"}'
# -> { "status": "added", "total": 6116, "remaining": 989 }

# Check your remaining credits — free
curl https://www.hiperbrain.com/api/credits/balance \\
  -H "Authorization: Bearer YOUR_KEY"
# -> { "balance": 989 }`}
        </pre>
        <p className="mt-3 text-xs leading-relaxed text-muted/70">
          Same base URL, one path per action: <code className="text-accent">/api/v1/ask</code>{" "}
          (read), <code className="text-accent">/api/v1/teach</code> (write),{" "}
          <code className="text-accent">/api/credits/balance</code>. A write only
          costs credits when the fact is genuinely new and passes verification —
          duplicates and rejected facts are refunded automatically.
        </p>
      </Step>
    </div>
  );
}

function KeyRow({
  record,
  revealed,
  deleting,
  onToggle,
  onCopy,
  onDelete,
}: {
  record: ApiKeyRecord;
  revealed: boolean;
  deleting: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const recoverable = Boolean(record.key);
  const display = !recoverable
    ? "•••• (created before keys were re-viewable — revoke and create a new one)"
    : revealed
      ? record.key!
      : `${record.key!.slice(0, 8)}${"•".repeat(24)}`;

  return (
    <li className="rounded-sm border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
          {display}
        </code>
        {recoverable && (
          <>
            <IconButton title={revealed ? "Hide key" : "Reveal key"} onClick={onToggle}>
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </IconButton>
            <IconButton title="Copy key" onClick={onCopy}>
              <CopyIcon />
            </IconButton>
          </>
        )}
        <IconButton title="Revoke key" onClick={onDelete} disabled={deleting} danger>
          {deleting ? <span className="px-1 text-[10px]">…</span> : <TrashIcon />}
        </IconButton>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted/70">
        {record.createdAt && <span>created {formatDate(record.createdAt)}</span>}
        <span>
          {record.lastUsedAt ? `last used ${formatDate(record.lastUsedAt)}` : "never used"}
        </span>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-surface/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border font-mono text-xs text-accent">
          {n}
        </span>
        <h2 className="font-mono text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "solid",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-sm px-4 py-2 font-mono text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "ghost"
          ? "border border-border text-muted hover:text-foreground"
          : "border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-muted hover:border-negative/50 hover:text-negative" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
