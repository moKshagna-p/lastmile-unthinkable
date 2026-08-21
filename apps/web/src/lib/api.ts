"use client";

/**
 * API client — cookie-based sessions (Better Auth). Every request forwards
 * credentials; a hard timeout keeps a dead API from hanging the UI forever.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${API_URL} — is it running?`,
      0,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}
