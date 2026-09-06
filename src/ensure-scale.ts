import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { classifyProgramType, extractProgramCeiling, type ProgramType } from "./program-scale";
import { fetchNoticeDescription } from "./notice-description";

type RawNotice = { description?: string | null } | null;

export type ScaleInfo = { programType: ProgramType | null; estimatedCeiling: number | null };

/** Fetches (and caches) a notice's description, then classifies it as a
 * plain solicitation vs. a BPA/IDIQ with a stated ceiling. Cached on the
 * opportunity row so repeat visits/syncs don't re-fetch SAM.gov. */
export async function ensureOpportunityScale(
  id: string,
  options: { force?: boolean } = {}
): Promise<{ text: string | null; fetchedAt: string | null; scale: ScaleInfo }> {
  const admin = getSupabaseAdmin();
  const { data: opp, error } = await admin
    .from("opportunities")
    .select(
      "id, title, raw_data, requirements_text, requirements_fetched_at, program_type, estimated_ceiling, scale_checked_at"
    )
    .eq("id", id)
    .single();
  if (error || !opp) throw new Error(error?.message ?? "Opportunity not found");

  const raw = opp.raw_data as RawNotice;
  const descriptionUrl = raw?.description ?? null;
  const title = (opp.title as string | null) ?? "";

  let text = (opp.requirements_text as string | null) ?? null;
  let fetchedAt = (opp.requirements_fetched_at as string | null) ?? null;
  const existingScale: ScaleInfo = {
    programType: (opp.program_type as ProgramType | null) ?? null,
    estimatedCeiling: (opp.estimated_ceiling as number | null) ?? null,
  };

  if (!options.force && opp.scale_checked_at) {
    return { text, fetchedAt, scale: existingScale };
  }

  if ((options.force || !text) && descriptionUrl) {
    try {
      text = await fetchNoticeDescription(descriptionUrl);
      fetchedAt = new Date().toISOString();
    } catch {
      // Title alone still gets classified below.
    }
  }

  const scaleSource = `${title}\n${text ?? ""}`;
  const scale: ScaleInfo = {
    programType: classifyProgramType(scaleSource),
    estimatedCeiling: extractProgramCeiling(scaleSource),
  };
  const scaleCheckedAt = new Date().toISOString();

  const { error: updErr } = await admin
    .from("opportunities")
    .update({
      requirements_text: text ?? opp.requirements_text,
      requirements_fetched_at: fetchedAt,
      program_type: scale.programType,
      estimated_ceiling: scale.estimatedCeiling,
      scale_checked_at: scaleCheckedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updErr) throw new Error(updErr.message);

  return { text, fetchedAt, scale };
}
