/** Where to actually send a response to this notice. The admin UI used to
 * hardcode a "Submit via PIEE" link on every notice, regardless of what the
 * notice itself said -- an audit caught a notice that required emailing the
 * quote directly to the contracting officer, where PIEE was never mentioned
 * and wasn't even the right destination. SAM.gov's search API doesn't expose
 * a structured submission channel, so this reads the same free-text
 * description already fetched for scale classification (requirements_text)
 * and looks for explicit "submit it here" instructions -- an email address
 * or a named portal, each anchored to actual submission language.
 *
 * A notice can name more than one channel (a portal plus a backup email, or
 * two acceptable addresses), so this returns every channel with evidence
 * rather than the first match. When nothing in the text supports a specific
 * destination, callers must show an honest "check submission instructions"
 * state instead of guessing at a default. */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Deliberately narrow to words that name the *thing being sent* (a quote,
 * response, proposal, offer) rather than generic verbs like "email" or
 * "send" -- nearly every notice also lists a contracting-officer email as a
 * point of contact for questions ("For questions, email jane.doe@agency.mil"),
 * and a generic verb would false-positive on that POC line as often as on a
 * real submission instruction. */
const SUBMISSION_CONTEXT_RE =
  /\b(?:submit|submitted|submission|quote|quotes|quotation|quotations|response|responses|proposal|proposals|offer|offers|bid|bids)\b/i;

export type SubmissionChannel =
  | { method: "email"; email: string; evidence: string }
  | { method: "portal"; name: string; url: string; evidence: string };

type PortalDefinition = {
  name: string;
  url: string;
  re: RegExp;
};

/** Named federal submission portals worth recognizing by name in notice
 * text. Kept short and specific -- a generic "submit via the portal"
 * mention with no named system is not evidence of which portal, so it is
 * deliberately left unmatched rather than guessed. */
const PORTAL_DEFINITIONS: PortalDefinition[] = [
  { name: "PIEE", url: "https://piee.eb.mil", re: /\bPIEE\b/i },
  { name: "FedConnect", url: "https://www.fedconnect.net", re: /\bFedConnect\b/i },
  { name: "GSA eBuy", url: "https://www.ebuy.gsa.gov", re: /\bGSA\s?eBuy\b/i },
  {
    name: "Unison Marketplace",
    url: "https://marketplace.unisonglobal.com",
    re: /\bUnison(?:\s+Marketplace)?\b/i,
  },
  { name: "Bonfire", url: "https://gobonfire.com", re: /\bBonfire\b/i },
];

function excerptAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 60);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function hasSubmissionContext(text: string, index: number, matchLength: number): boolean {
  const before = text.slice(Math.max(0, index - 100), index);
  const after = text.slice(index + matchLength, index + matchLength + 40);
  return SUBMISSION_CONTEXT_RE.test(before) || SUBMISSION_CONTEXT_RE.test(after);
}

type IndexedChannel = { index: number; channel: SubmissionChannel };

function findEmailChannels(text: string): IndexedChannel[] {
  const found: IndexedChannel[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(EMAIL_RE)) {
    const index = match.index ?? 0;
    if (!hasSubmissionContext(text, index, match[0].length)) continue;
    const email = match[0].replace(/[.,;:]+$/, "");
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      index,
      channel: { method: "email", email, evidence: excerptAround(text, index, match[0].length) },
    });
  }
  return found;
}

function findPortalChannels(text: string): IndexedChannel[] {
  const found: IndexedChannel[] = [];
  const seen = new Set<string>();
  for (const portal of PORTAL_DEFINITIONS) {
    const match = portal.re.exec(text);
    if (!match) continue;
    const index = match.index ?? 0;
    if (!hasSubmissionContext(text, index, match[0].length)) continue;
    if (seen.has(portal.name)) continue;
    seen.add(portal.name);
    found.push({
      index,
      channel: {
        method: "portal",
        name: portal.name,
        url: portal.url,
        evidence: excerptAround(text, index, match[0].length),
      },
    });
  }
  return found;
}

/** Finds every explicit submission channel in a notice's description text,
 * ordered by where the evidence appears. Returns an empty array (meaning:
 * no explicit destination found -- callers must show "check submission
 * instructions", never a default guess) when the text names no address or
 * recognized portal alongside submission language. */
export function extractSubmissionMethods(text: string | null | undefined): SubmissionChannel[] {
  if (!text) return [];

  return [...findPortalChannels(text), ...findEmailChannels(text)]
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.channel);
}
