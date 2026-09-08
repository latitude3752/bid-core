import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time comparison of a caller-supplied header value against an
 * expected secret (optionally prefixed, e.g. "Bearer "). Fails closed if
 * the secret is unset -- an unset secret must never authorize a request.
 * Shared by cron-auth.ts (Vercel Cron calling this app) and relay-auth.ts
 * (a sibling app calling this app), which previously each hand-rolled the
 * identical Buffer-length-then-timingSafeEqual pattern. */
export function constantTimeSecretMatch(
  candidate: string | null,
  secret: string | undefined,
  prefix = "",
): boolean {
  if (!secret) return false;
  const expected = prefix + secret;
  const a = Buffer.from(candidate ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
