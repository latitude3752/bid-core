import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { getSupabasePublic } from "./supabase/public";

export type NaicsCode = {
  code: string;
  label: string;
  active: boolean;
};

/** All registered NAICS codes (including inactive), for admin management. */
export async function getAllNaicsCodes(): Promise<NaicsCode[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("naics_codes")
    .select("code, label, active")
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Active NAICS codes only — what the SAM.gov sync job searches. */
export async function getActiveNaicsCodes(): Promise<NaicsCode[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("naics_codes")
    .select("code, label, active")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Active NAICS codes via the anon client, for the public /opportunities page. */
export async function getPublicNaicsCodes(): Promise<NaicsCode[]> {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from("naics_codes")
    .select("code, label, active")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
}
