/**
 * HiperbrainClient — the thin HTTP client for the hosted, credit-metered API.
 *
 * The rest of this package is a pure, offline HDC engine: it runs entirely on
 * the caller's machine and knows only what you teach it locally. This client is
 * the opposite half — it reasons over the *live collective brain* on
 * hiperbrain.com, where every read and write is metered in credits.
 *
 *   import { HiperbrainClient } from "@hiperbrain/core";
 *
 *   const hb = new HiperbrainClient({ apiKey: "hb_live_..." });
 *   const { answer, remaining } = await hb.ask("France", "capital"); // 1 credit
 *   await hb.teach({ subject: "Slovenia", relation: "capital", object: "Ljubljana" }); // 10 credits
 *   const credits = await hb.balance(); // free
 *
 * The API key is mandatory. It is minted on hiperbrain.com/token after burning
 * tokens for credits, and every call spends the credits of the wallet that key
 * belongs to. Credits are enforced server-side; the key only authenticates the
 * request — it grants nothing on its own.
 */

import { type Confidence, type Fact } from "./knowledge";
import { type Match } from "./itemMemory";

/** The default origin of the hosted API. Override via `baseUrl` for self-hosting. */
export const DEFAULT_BASE_URL = "https://www.hiperbrain.com";

/** A `fetch`-compatible function, so non-standard runtimes can inject their own. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface HiperbrainClientOptions {
  /** The API key minted on hiperbrain.com/token. Required. */
  apiKey: string;
  /** Override the API origin (no trailing slash). Defaults to hiperbrain.com. */
  baseUrl?: string;
  /** A custom `fetch` implementation. Defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** The result of a metered `ask` — the answer plus the remaining credit balance. */
export interface AskResult {
  /** The single best answer, or null if the brain has nothing confident. */
  answer: string | null;
  /** The top-k ranked candidates with their similarity scores. */
  matches: Match[];
  /** Calibrated confidence for the recall. */
  confidence: Confidence;
  /** Credits left on the key's wallet after this call. */
  remaining: number;
}

/** How a metered `teach` landed in the collective brain. */
export type TeachStatus =
  | "added"
  | "replaced"
  | "duplicate"
  | "superseded"
  | "disputed";

/** The result of a metered `teach`. */
export interface TeachResult {
  status: TeachStatus;
  /** The fact as the brain stored it. */
  fact: Fact;
  /** Why a contradiction was resolved this way (replaced/superseded/disputed). */
  reason?: string;
  /** Total facts in the brain after this write. */
  total: number;
  /** Credits left on the key's wallet. Refunded automatically when nothing
   *  new and active landed (duplicate, rejected, full, lost contradiction). */
  remaining: number;
}

/** Thrown for any non-2xx API response. Carries the HTTP status and parsed body. */
export class HiperbrainApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "HiperbrainApiError";
    this.status = status;
    this.body = body;
  }
  /** True when the wallet behind the key has run out of credits (HTTP 402). */
  get outOfCredits(): boolean {
    return this.status === 402;
  }
  /** True when the key is missing, malformed or unknown (HTTP 401). */
  get unauthorized(): boolean {
    return this.status === 401;
  }
}

export interface AskOptions {
  /** How many ranked candidates to return (1–10, default 5). */
  k?: number;
  /** Abort the request via an AbortController signal. */
  signal?: AbortSignal;
}

export interface TeachOptions {
  /** Optional citation stored as provenance for the fact. */
  sourceUrl?: string;
  signal?: AbortSignal;
}

export class HiperbrainClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly doFetch: FetchLike;

  constructor(options: HiperbrainClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new Error(
        "HiperbrainClient requires an apiKey. Mint one at https://www.hiperbrain.com/token.",
      );
    }
    const fetchImpl =
      options.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!fetchImpl) {
      throw new Error(
        "No fetch implementation found. Pass one via the `fetch` option (Node < 18 has no global fetch).",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.doFetch = fetchImpl;
  }

  private async post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
    return this.parse<T>(res);
  }

  private async parse<T>(res: {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }): Promise<T> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* no/invalid JSON body */
    }
    if (!res.ok) {
      const message =
        (body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : null) ?? `Request failed with status ${res.status}.`;
      throw new HiperbrainApiError(res.status, message, body);
    }
    return body as T;
  }

  /**
   * Ask the live collective brain "what is the <relation> of <subject>?".
   * Costs 1 credit. Throws {@link HiperbrainApiError} (402) when out of credits.
   */
  ask(subject: string, relation: string, options: AskOptions = {}): Promise<AskResult> {
    const payload: { subject: string; relation: string; k?: number } = {
      subject,
      relation,
    };
    if (options.k !== undefined) payload.k = options.k;
    return this.post<AskResult>("/api/v1/ask", payload, options.signal);
  }

  /**
   * Teach the brain a new fact. Costs 10 credits, but the charge is refunded
   * automatically whenever the fact does not land as new and active (duplicate,
   * rejected by the AI checker, brain full, or lost a contradiction). Throws
   * {@link HiperbrainApiError} on rejection (422), a full brain (409) or when
   * out of credits (402).
   */
  teach(fact: Fact, options: TeachOptions = {}): Promise<TeachResult> {
    const payload: Fact & { source_url?: string } = { ...fact };
    if (options.sourceUrl) payload.source_url = options.sourceUrl;
    return this.post<TeachResult>("/api/v1/teach", payload, options.signal);
  }

  /** The remaining credit balance for this key. Free — does not spend a credit. */
  async balance(signal?: AbortSignal): Promise<number> {
    const res = await this.doFetch(`${this.baseUrl}/api/credits/balance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal,
    });
    const data = await this.parse<{ balance: number }>(res);
    return Number(data.balance);
  }
}
