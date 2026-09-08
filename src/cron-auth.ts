import "server-only";
import { constantTimeSecretMatch } from "./constant-time-secret";

/** Constant-time comparison — a naive `!==` leaks how many leading bytes of
 * CRON_SECRET matched via response timing. Shared by every sync route
 * (SAM.gov contracts, grants) since they're all triggered the same way. */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  return constantTimeSecretMatch(authHeader, process.env.CRON_SECRET, "Bearer ");
}
