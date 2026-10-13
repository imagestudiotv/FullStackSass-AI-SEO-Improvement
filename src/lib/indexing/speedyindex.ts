/**
 * SpeedyIndex (https://en.speedyindex.com), which asks Google to index URLs.
 *
 * API v2, documented at github.com/SpeedyIndexcom/speedyindexapi. The key goes
 * in the Authorization header as-is (no "Bearer"). Every answer carries a
 * `code`: 0 done, 1 not enough balance, 2 the request was invalid.
 *
 * Google tasks are pay-per-indexed only: 100 tokens per URL Google indexes,
 * the rest refunded when the task finishes (about a week). First results
 * usually come within 48-72 hours.
 *
 * Server-only. The key is never logged or returned.
 */

const DEFAULT_BASE = "https://api.speedyindex.com";
const TIMEOUT_MS = 20_000;

/** Tokens SpeedyIndex charges per URL Google indexes. */
export const TOKENS_PER_INDEXED_URL = 100;

export function isIndexingConfigured(): boolean {
  return Boolean(process.env.SPEEDYINDEX_API_KEY?.trim());
}

export type SpeedyIndexFailure = "balance" | "invalid" | "http" | "network" | "response";

export class SpeedyIndexError extends Error {
  constructor(
    message: string,
    readonly reason: SpeedyIndexFailure,
  ) {
    super(message);
    this.name = "SpeedyIndexError";
  }
}

type Answer = Record<string, unknown> & { code?: unknown };

async function call(path: string, body?: unknown, timeoutMs = TIMEOUT_MS): Promise<Answer> {
  const key = process.env.SPEEDYINDEX_API_KEY?.trim();
  if (!key) throw new SpeedyIndexError("SpeedyIndex is not configured", "invalid");
  const base = (process.env.SPEEDYINDEX_API_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, "");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw new SpeedyIndexError(`SpeedyIndex did not answer: ${error instanceof Error ? error.name : "error"}`, "network");
  }

  let answer: Answer;
  try {
    answer = (await response.json()) as Answer;
  } catch {
    throw new SpeedyIndexError(`SpeedyIndex answered HTTP ${response.status} without JSON`, response.ok ? "response" : "http");
  }
  if (!answer || typeof answer !== "object") throw new SpeedyIndexError("SpeedyIndex answered without a result", "response");

  const code = Number(answer.code);
  if (code === 1) throw new SpeedyIndexError("The SpeedyIndex balance is empty - top it up", "balance");
  if (code === 2) throw new SpeedyIndexError("SpeedyIndex refused the request as invalid", "invalid");
  if (!response.ok) throw new SpeedyIndexError(`SpeedyIndex answered HTTP ${response.status}`, "http");
  if (code !== 0) throw new SpeedyIndexError(`SpeedyIndex answered code ${String(answer.code)}`, "response");
  return answer;
}

/** Sends URLs to Google's indexer as one task; returns the task id. */
export async function createIndexTask(urls: string[], title: string): Promise<string> {
  const answer = await call("/v2/task/google/indexer/create", { title: title.slice(0, 100), urls, pay_per_indexed: true });
  const taskId = typeof answer.task_id === "string" ? answer.task_id : "";
  if (!taskId) throw new SpeedyIndexError("SpeedyIndex accepted the task but returned no task id", "response");
  return taskId;
}

export type TaskStatus = { id: string; size: number; processed: number; indexed: number; completed: boolean };

/** Progress of up to 1,000 tasks in one call. Tasks SpeedyIndex does not know are left out. */
export async function readTaskStatuses(taskIds: string[]): Promise<TaskStatus[]> {
  if (taskIds.length === 0) return [];
  const answer = await call("/v2/task/google/indexer/status", { task_ids: taskIds.slice(0, 1000) });
  const rows = Array.isArray(answer.result) ? (answer.result as Record<string, unknown>[]) : [];
  return rows
    .filter((row) => row && typeof row.id === "string")
    .map((row) => ({
      id: row.id as string,
      size: Number(row.size) || 0,
      processed: Number(row.processed_count) || 0,
      indexed: Number(row.indexed_count) || 0,
      completed: row.is_completed === true,
    }));
}

export type TaskReport = {
  indexed: string[];
  /** errorCode: -1 a noindex tag, 0 none, otherwise the HTTP status the page answered. */
  unindexed: { url: string; errorCode: number | null }[];
};

/** Which of a task's URLs are indexed, and which are not (with why, when known). */
export async function readTaskReport(taskId: string): Promise<TaskReport> {
  const answer = await call("/v2/task/google/indexer/fullreport", { task_id: taskId });
  const result = (answer.result ?? {}) as Record<string, unknown>;
  const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []).filter((row) => row && typeof row.url === "string");
  return {
    indexed: list(result.indexed_links).map((row) => row.url as string),
    unindexed: list(result.unindexed_links).map((row) => {
      const code = row.error_code === undefined || row.error_code === null ? null : Number(row.error_code);
      return { url: row.url as string, errorCode: Number.isFinite(code) ? code : null };
    }),
  };
}

/** Tokens left on the account, for the admin overview. */
export async function readTokenBalance(timeoutMs = 5_000): Promise<number | null> {
  const answer = await call("/v2/account", undefined, timeoutMs);
  const balance = (answer.balance ?? {}) as Record<string, unknown>;
  const tokens = Number(balance.tokens);
  return Number.isFinite(tokens) ? tokens : null;
}

/**
 * The same page, however SpeedyIndex echoes it back: host case, a trailing
 * slash and a fragment do not make a different URL.
 */
export function sameUrl(a: string, b: string): boolean {
  const key = (value: string) => {
    try {
      const url = new URL(value.trim());
      url.hash = "";
      return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}${url.search}`;
    } catch {
      return value.trim().replace(/\/+$/, "");
    }
  };
  return key(a) === key(b);
}

/** What an unindexed URL's error code means, in words an operator can act on. */
export function describeErrorCode(code: number | null): string {
  if (code === -1) return "The page has a noindex tag";
  if (code !== null && code >= 300) return `The page answered HTTP ${code}`;
  return "Google did not index it";
}
