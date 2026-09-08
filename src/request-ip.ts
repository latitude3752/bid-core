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
 *  - `TRUST_PROXY_HEADERS` is set to "1" or "true" (case-insensitive), an
 *    explicit opt-in for self-hosted operators running behind their own
 *    reverse proxy that they've configured to overwrite these headers
 *    with the real client IP.
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
let unrecognizedTrustProxyValueWarned = false;

/** Accepts "1"/"true" case-insensitively (trimmed, so a trailing newline
 * from a .env exporter doesn't silently defeat the opt-in); warns once
 * (rather than failing silently) if the var is set to something else
 * non-empty, since an operator who mistypes it would otherwise have no
 * signal that per-client lockout still isn't active. */
function isTrustProxyHeadersEnabled(): boolean {
  const raw = process.env.TRUST_PROXY_HEADERS?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === "1" || raw === "true") return true;
  if (!unrecognizedTrustProxyValueWarned) {
    unrecognizedTrustProxyValueWarned = true;
    console.warn(
      `[request-ip] TRUST_PROXY_HEADERS is set to an unrecognized value ` +
        `(expected "1" or "true") -- treating it as unset, so IP-based ` +
        `rate-limiting/lockout will use a shared "unknown" bucket.`,
    );
  }
  return false;
}

export function clientIpFromHeaders(headerStore: {
  get(name: string): string | null;
}): string {
  // Vercel always sets VERCEL="1" (see the docs link above); checking for
  // that exact value rather than `Boolean(process.env.VERCEL)` avoids the
  // classic env-var footgun where a stray VERCEL="0" (e.g. copied from a
  // template, or a non-Vercel tool using 0/1 for its own unrelated flag)
  // would otherwise coerce truthy and enable trust with no real Vercel
  // edge in front of the request.
  const trustProxyHeaders = process.env.VERCEL === "1" || isTrustProxyHeadersEnabled();
  if (!trustProxyHeaders) return "unknown";
  // A misbehaving/double-configured proxy chain could set X-Real-IP more
  // than once; Headers.get() then returns the values joined with ", ".
  // Apply the same last-entry-or-fail-closed handling as X-Forwarded-For
  // below rather than trusting a raw, possibly-compound string verbatim.
  const realIp = headerStore.get("x-real-ip")?.split(",").pop()?.trim();
  if (realIp) return realIp;
  const forwardedFor = headerStore.get("x-forwarded-for");
  // Take the raw last comma-separated entry (not the first) and fail
  // closed to "unknown" if that specific position is blank, rather than
  // reaching past it to an earlier, less-trusted segment.
  const last = forwardedFor?.split(",").pop()?.trim();
  return last || "unknown";
}
