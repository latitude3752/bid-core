import "server-only";

/**
 * Best-effort client IP for rate-limiting / lockout keys, given a header
 * accessor (e.g. the result of Next.js's `headers()`).
 *
 * X-Real-IP and X-Forwarded-For are trusted when either:
 *  - running on Vercel (the `VERCEL` env var Vercel sets on every
 *    deployment), where the edge overwrites these headers with its own
 *    observed IP and never forwards a client-supplied value -- see
 *    https://vercel.com/docs/headers/request-headers; or
 *  - `TRUST_PROXY_HEADERS=1` is set, an explicit opt-in for self-hosted
 *    operators running behind their own reverse proxy that they've
 *    configured to overwrite these headers with the real client IP.
 *
 * Neither is trusted by default off Vercel: an unconfigured self-hosted
 * deployment (no reverse proxy stripping these headers) would otherwise
 * let an attacker set X-Real-IP directly on every request to get a fresh
 * rate-limit/lockout bucket each time, bypassing brute-force lockout
 * entirely -- the same vulnerability class this function exists to close.
 * Self-hosted operators who've done that reverse-proxy configuration set
 * TRUST_PROXY_HEADERS=1 to restore per-client tracking; leaving it unset
 * is the safe default (all such requests fail closed to "unknown," a
 * shared bucket, rather than trusting a spoofable header).
 *
 * Previously duplicated (and independently bug-fixed three times in a row)
 * across bidhawk, bidyard, and bidpulse's local admin/login actions.ts --
 * centralized here so a future fix only has to be made once.
 */
export function clientIpFromHeaders(headerStore: {
  get(name: string): string | null;
}): string {
  const trustProxyHeaders =
    Boolean(process.env.VERCEL) || process.env.TRUST_PROXY_HEADERS === "1";
  if (!trustProxyHeaders) return "unknown";
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwardedFor = headerStore.get("x-forwarded-for");
  // Take the raw last comma-separated entry (not the first) and fail
  // closed to "unknown" if that specific position is blank, rather than
  // reaching past it to an earlier, less-trusted segment.
  const last = forwardedFor?.split(",").pop()?.trim();
  return last || "unknown";
}
