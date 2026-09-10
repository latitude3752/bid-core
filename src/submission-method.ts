/** Where to actually send a response to this notice. The admin UI used to
 * hardcode a "Submit via PIEE" link on every notice, regardless of what the
 * notice itself said -- an audit caught a notice that required emailing the
 * quote directly to the contracting officer, where PIEE was never mentioned
 * and wasn't even the right destination. SAM.gov's search API doesn't expose
 * a structured submission channel, so this reads the same free-text
 * description already fetched for scale classification (requirements_text)
 * and looks for an explicit "email it here" instruction. */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Deliberately narrow to words that name the *thing being sent* (a quote,
 * response, proposal, offer) rather than generic verbs like "email" or
 * "send" -- nearly every notice also lists a contracting-officer email as a
 * point of contact for questions ("For questions, email jane.doe@agency.mil"),
 * and a generic verb would false-positive on that POC line as often as on a
 * real submission instruction. */
const SUBMISSION_CONTEXT_RE =
  /\b(?:submit|submitted|submission|quote|quotes|quotation|quotations|response|responses|proposal|proposals|offer|offers|bid|bids)\b/i;

export type SubmissionMethod = { method: "email"; email: string };

/** Finds an explicit "email your response to X" instruction in a notice's
 * description text. Returns null (meaning: no override found, fall back to
 * the default PIEE/portal submission link) unless an email address sits
 * within a short window of a submission-context word on both sides -- e.g.
 * "Quotes shall be emailed to jane.doe@agency.mil" or "Submit your response
 * via email to jane.doe@agency.mil by the closing date". */
export function extractSubmissionMethod(text: string | null | undefined): SubmissionMethod | null {
  if (!text) return null;

  for (const match of text.matchAll(EMAIL_RE)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 100), index);
    const after = text.slice(index + match[0].length, index + match[0].length + 40);
    if (SUBMISSION_CONTEXT_RE.test(before) || SUBMISSION_CONTEXT_RE.test(after)) {
      return { method: "email", email: match[0].replace(/[.,;:]+$/, "") };
    }
  }

  return null;
}
