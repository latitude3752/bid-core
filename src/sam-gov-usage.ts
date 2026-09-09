import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";

export type SamGovUsageRow = { app: string; call_date: string; count: number };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increments today's SAM.gov call tally for one app, in BidHawk's own
 * Supabase project -- the single shared "hub" all four apps' usage rolls
 * up into, since the SAM.gov key itself is shared but each app's business
 * data stays isolated. Only ever call this from BidHawk's own code (its
 * sync route, or its /api/sam-usage/report endpoint); a sibling app has no
 * BidHawk Supabase credentials, so it reports over HTTP via
 * reportSamGovUsage instead. */
export async function recordSamGovUsage(app: string, count: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("increment_sam_gov_usage", {
    p_app: app,
    p_call_date: todayUtc(),
    p_count: count,
  });
  if (error) throw new Error(error.message);
}

/** Today's per-app SAM.gov usage plus the combined total, for display on
 * BidHawk's /admin/sync-status -- the only place with visibility into the
 * whole shared-quota picture across all four apps. */
export async function getSamGovUsageToday(): Promise<{ rows: SamGovUsageRow[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sam_gov_usage")
    .select("app, call_date, count")
    .eq("call_date", todayUtc());
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SamGovUsageRow[];
  return { rows, total: rows.reduce((sum, r) => sum + r.count, 0) };
}

/** Best-effort report from a sibling app to BidHawk's usage hub after an
 * on-demand SAM.gov call (price research / scale refresh). Never throws --
 * this is telemetry about a call that already happened, so a reporting
 * failure must never fail or delay the user-facing action it's about. */
export async function reportSamGovUsage(hubBaseUrl: string, app: string, count = 1): Promise<void> {
  try {
    await fetch(`${hubBaseUrl}/api/sam-usage/report`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-relay-secret": process.env.SAM_RELAY_SECRET ?? "" },
      body: JSON.stringify({ app, count }),
    });
  } catch {
    // Best-effort telemetry; swallow network/DNS/timeout failures.
  }
}
