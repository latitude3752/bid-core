import "server-only";
import { constantTimeSecretMatch } from "./constant-time-secret";

/** Constant-time comparison for the shared secret BidHawk's SAM.gov relay
 * uses to call a sibling app's naics-codes and ingest-opportunities
 * endpoints -- separate from CRON_SECRET (Vercel's own scheduler calling
 * this app) because the caller here is a sibling app, not Vercel Cron. */
export function isAuthorizedRelayRequest(headerValue: string | null): boolean {
  return constantTimeSecretMatch(headerValue, process.env.SAM_RELAY_SECRET);
}
