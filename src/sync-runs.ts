import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";

export type SyncRunSource = "direct" | "relay";

export type SyncRun = {
  id: number;
  source: SyncRunSource;
  upserted: number;
  error_count: number;
  errors: string[];
  ran_at: string;
};

/** Records one sync/ingest invocation for /admin/sync-status and the daily
 * freshness check. Never throws -- a logging failure shouldn't fail the
 * sync job that produced the data it's trying to log. */
export async function recordSyncRun(run: {
  source: SyncRunSource;
  upserted: number;
  errors: string[];
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sync_runs").insert({
      source: run.source,
      upserted: run.upserted,
      error_count: run.errors.length,
      errors: run.errors,
    });
    if (error) console.error("recordSyncRun failed:", error.message);
  } catch (err) {
    console.error("recordSyncRun failed:", err);
  }
}

export async function listRecentSyncRuns(limit = 20): Promise<SyncRun[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("id, source, upserted, error_count, errors, ran_at")
    .order("ran_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SyncRun[];
}

/** Null when there has never been a successful (zero-error) run at all. */
export async function lastSuccessfulSyncRun(): Promise<SyncRun | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("id, source, upserted, error_count, errors, ran_at")
    .eq("error_count", 0)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SyncRun | null) ?? null;
}
