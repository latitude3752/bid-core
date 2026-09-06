/** Program-level scale: is this an ordinary one-off RFQ (never prices
 * disclosed) or a BPA/IDIQ with a stated ceiling that implies a catalog,
 * an ordering period, and years of follow-on work? A $25,000,000 BPA and a
 * $5,000 spot buy require completely different effort, but SAM.gov's search
 * API doesn't expose contract value -- it only shows up, if at all, in the
 * notice's free-text description, phrased as a ceiling near a dollar figure. */

/** Captures the numeric figure plus an optional "million/M/thousand/K"
 * magnitude word or suffix -- "$50 million", "$2.5M", "$500K" are all common
 * ways agencies phrase an estimated program value without spelling out
 * every zero. `\b` after the suffix group keeps a bare "M"/"K" from
 * matching as a prefix of an unrelated word ("$50 machines", "$50 kilograms"). */
const DOLLAR_RE = /\$\s?([\d][\d,]*(?:\.\d+)?)\s*(million|mil|thousand|k|m)?\b/gi;

const CEILING_KEYWORDS =
  /bpa ceiling|idiq ceiling|contract ceiling|program ceiling|ceiling (?:price|amount|value)|not[-\s]+(?:to[-\s]+)?exceed|\bnte\b|maximum order value|estimated (?:total|annual) value/i;

const MAGNITUDE_MULTIPLIERS: Record<string, number> = {
  million: 1_000_000,
  mil: 1_000_000,
  m: 1_000_000,
  thousand: 1_000,
  k: 1_000,
};

/** Largest dollar figure found within a keyword's context window (ceiling
 * language typically sits within ~60 chars of the number, either side --
 * "BPA ceiling: $25,000,000", "$25,000,000 ceiling", or "the total contract
 * ceiling ... is $25,000,000"). Ordinary line-item prices without ceiling
 * language nearby are ignored, so a BPA's per-CLIN catalog prices don't get
 * mistaken for the program ceiling. */
export function extractProgramCeiling(text: string | null | undefined): number | null {
  if (!text) return null;
  let best: number | null = null;
  for (const m of text.matchAll(DOLLAR_RE)) {
    const index = m.index ?? 0;
    const window = text.slice(Math.max(0, index - 60), index + m[0].length + 25);
    if (!CEILING_KEYWORDS.test(window)) continue;
    const base = Number(m[1].replace(/,/g, ""));
    const multiplier = MAGNITUDE_MULTIPLIERS[(m[2] ?? "").toLowerCase()] ?? 1;
    const value = base * multiplier;
    if (Number.isFinite(value) && value > 0 && (best === null || value > best)) {
      best = value;
    }
  }
  return best;
}

export type ProgramType = "bpa" | "idiq";

/** BPA/IDIQ vs. plain solicitation, from title + notice text. */
export function classifyProgramType(text: string | null | undefined): ProgramType | null {
  if (!text) return null;
  if (/\bidiq\b|indefinite[-\s]delivery/i.test(text)) return "idiq";
  if (/\bbpa\b|blanket purchase agreement/i.test(text)) return "bpa";
  return null;
}
