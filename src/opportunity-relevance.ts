import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";

export async function listRelevanceVotes(
  actorKey: string,
  opportunityIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (!actorKey || opportunityIds.length === 0) return map;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("opportunity_relevance")
    .select("opportunity_id, useful")
    .eq("actor_key", actorKey)
    .in("opportunity_id", opportunityIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.opportunity_id as string, Boolean(row.useful));
  }
  return map;
}

export async function setRelevanceVote(
  actorKey: string,
  opportunityId: string,
  useful: boolean
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase.from("opportunity_relevance").upsert(
    {
      opportunity_id: opportunityId,
      actor_key: actorKey,
      useful,
      updated_at: now,
    },
    { onConflict: "opportunity_id,actor_key" }
  );
  if (error) throw new Error(error.message);
}
