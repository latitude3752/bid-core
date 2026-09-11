import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";

export type SyncRunSource = "direct" | "relay" | "gpr" | "tx-esbd" | "va-eva" | "bonfire";

export type SyncRun = {
  id: number;
  source: SyncRunSource;
  fetched: number | null;
  upserted: number;
  error_count: number;
  errors: string[];
  ran_at: string;
};

const SELECT_COLUMNS = "id, source, fetched, upserted, error_count, errors, ran_at";

/** Records one sync/ingest invocation for /admin/sync-status and the daily
 * freshness check. Never throws -- a logging failure shouldn't fail the
 * sync job that produced the data it's trying to log. `fetched` is the raw
 * count returned by the upstream source before any upsert/dedup, so a
 * healthy-looking `upserted` can still be compared against a collapsing
 * `fetched` to catch an upstream format change early; omit it only for
 * sources (like the legacy direct/relay SAM.gov pipeline) that never
 * tracked it. */
export async function recordSyncRun(run: {
  source: SyncRunSource;
  fetched?: number;
  upserted: number;
  errors: string[];
}): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("sync_runs").insert({
      source: run.source,
      fetched: run.fetched ?? null,
      upserted: run.upserted,
      error_count: run.errors.length,
      errors: run.errors,
    });
    if (error) console.error("recordSyncRun failed:", error.message);
  } catch (err) {
    console.error("recordSyncRun failed:", err);
  }
}

export async function listRecentSyncRuns(limit = 20, sources?: SyncRunSource[]): Promise<SyncRun[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("sync_runs").select(SELECT_COLUMNS);
  if (sources && sources.length > 0) query = query.in("source", sources);
  const { data, error } = await query.order("ran_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as SyncRun[];
}

/** Null when there has never been a successful (zero-error) run at all.
 * Pass `sources` to scope the check to a subset (e.g. the daily SAM.gov
 * freshness check must only ever look at ["direct", "relay"] -- a healthy
 * GA/TX/VA/Bonfire run must never mask a dead SAM.gov cron, or vice versa). */
export async function lastSuccessfulSyncRun(sources?: SyncRunSource[]): Promise<SyncRun | null> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("sync_runs").select(SELECT_COLUMNS).eq("error_count", 0);
  if (sources && sources.length > 0) query = query.in("source", sources);
  const { data, error } = await query.order("ran_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SyncRun | null) ?? null;
}

export type SourceHealthGroup = {
  label: string;
  sources: SyncRunSource[];
  lastRun: SyncRun | null;
  lastSuccess: SyncRun | null;
};

/** Per-source-group last-attempt/last-success breakdown for the
 * /admin/sync-status dashboard. A group can bundle more than one
 * SyncRunSource (e.g. SAM.gov's "direct" and "relay") so the dashboard can
 * show one health card per real-world data source even when an app writes
 * more than one source value for it. */
export async function sourceHealthSummary(
  groups: { label: string; sources: SyncRunSource[] }[]
): Promise<SourceHealthGroup[]> {
  const supabase = getSupabaseAdmin();
  const results: SourceHealthGroup[] = [];
  for (const group of groups) {
    const [lastRunRes, lastSuccessRes] = await Promise.all([
      supabase
        .from("sync_runs")
        .select(SELECT_COLUMNS)
        .in("source", group.sources)
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("sync_runs")
        .select(SELECT_COLUMNS)
        .in("source", group.sources)
        .eq("error_count", 0)
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (lastRunRes.error) throw new Error(lastRunRes.error.message);
    if (lastSuccessRes.error) throw new Error(lastSuccessRes.error.message);
    results.push({
      label: group.label,
      sources: group.sources,
      lastRun: (lastRunRes.data as SyncRun | null) ?? null,
      lastSuccess: (lastSuccessRes.data as SyncRun | null) ?? null,
    });
  }
  return results;
}
