import "server-only";

/**
 * Best-effort client IP for rate-limiting / lockout keys, given a header
 * accessor (e.g. the result of Next.js's `headers()`).
 *
 * X-Real-IP and X-Forwarded-For are only trusted when running on Vercel
 * (the `VERCEL` env var Vercel sets on every deployment), where the edge
 * overwrites these headers with its own observed IP and never forwards a
 * client-supplied value -- see https://vercel.com/docs/headers/request-headers.
 * A self-hosted deployment can't make the same guarantee without its own
 * reverse proxy correctly stripping/overwriting these headers first, so
 * trusting them unconditionally there would let an attacker set X-Real-IP
 * directly on every request to get a fresh rate-limit/lockout bucket each
 * time, bypassing brute-force lockout entirely -- the same vulnerability
 * class this function exists to close. Self-hosted operators who terminate
 * TLS behind their own trusted reverse proxy and want per-client lockout
 * should have it rewrite these headers before this check will trust them
 * (not yet configurable here).
 *
 * Previously duplicated (and independently bug-fixed three times in a row)
 * across bidhawk, bidyard, and bidpulse's local admin/login actions.ts --
 * centralized here so a future fix only has to be made once.
 */
export function clientIpFromHeaders(headerStore: {
  get(name: string): string | null;
}): string {
  if (!process.env.VERCEL) return "unknown";
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwardedFor = headerStore.get("x-forwarded-for");
  // Take the raw last comma-separated entry (not the first) and fail
  // closed to "unknown" if that specific position is blank, rather than
  // reaching past it to an earlier, less-trusted segment.
  const last = forwardedFor?.split(",").pop()?.trim();
  return last || "unknown";
}
