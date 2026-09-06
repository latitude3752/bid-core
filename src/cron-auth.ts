import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time comparison — a naive `!==` leaks how many leading bytes of
 * CRON_SECRET matched via response timing. Shared by every sync route
 * (SAM.gov contracts, grants) since they're all triggered the same way. */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
