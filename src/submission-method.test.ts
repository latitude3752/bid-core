import { describe, expect, it } from "vitest";
import { extractSubmissionMethods } from "./submission-method";

describe("extractSubmissionMethods", () => {
  it("finds an email instruction stated before the address", () => {
    const text = "Quotes shall be emailed to jane.doe@agency.mil no later than the closing date.";
    expect(extractSubmissionMethods(text)).toEqual([
      expect.objectContaining({ method: "email", email: "jane.doe@agency.mil" }),
    ]);
  });

  it("finds an email instruction stated after the address", () => {
    const text = "Send your response to john.smith@agency.gov -- quotations submitted elsewhere will not be considered.";
    expect(extractSubmissionMethods(text)).toEqual([
      expect.objectContaining({ method: "email", email: "john.smith@agency.gov" }),
    ]);
  });

  it("ignores a point-of-contact email with no submission language nearby", () => {
    const text = "For questions about this solicitation, email jane.doe@agency.mil.";
    expect(extractSubmissionMethods(text)).toEqual([]);
  });

  it("strips trailing punctuation from the captured address", () => {
    const text = "Submit your quote via email to jane.doe@agency.mil.";
    expect(extractSubmissionMethods(text)).toEqual([
      expect.objectContaining({ method: "email", email: "jane.doe@agency.mil" }),
    ]);
  });

  it("returns an empty array for missing text", () => {
    expect(extractSubmissionMethods(null)).toEqual([]);
    expect(extractSubmissionMethods(undefined)).toEqual([]);
    expect(extractSubmissionMethods("")).toEqual([]);
  });

  it("returns an empty array when no address or named portal is present", () => {
    expect(extractSubmissionMethods("Submit your quote through the online portal by the closing date.")).toEqual([]);
  });

  it("recognizes a named portal mentioned with submission language", () => {
    const text = "Quotes must be submitted through PIEE prior to the response deadline.";
    expect(extractSubmissionMethods(text)).toEqual([
      expect.objectContaining({ method: "portal", name: "PIEE", url: "https://piee.eb.mil" }),
    ]);
  });

  it("does not treat a bare portal mention with no submission language as evidence", () => {
    const text = "Questions about a prior PIEE outage should be directed to the contracting officer.";
    expect(extractSubmissionMethods(text)).toEqual([]);
  });

  it("recognizes GSA eBuy and FedConnect by name", () => {
    expect(
      extractSubmissionMethods("Responses shall be submitted via FedConnect only.")
    ).toEqual([expect.objectContaining({ method: "portal", name: "FedConnect" })]);
    expect(
      extractSubmissionMethods("Quotes must be submitted through GSA eBuy.")
    ).toEqual([expect.objectContaining({ method: "portal", name: "GSA eBuy" })]);
  });

  it("returns multiple channels in text order when a notice gives more than one instruction", () => {
    const text =
      "Submit your proposal through PIEE. If PIEE is unavailable, email your proposal to backup@agency.mil instead.";
    const result = extractSubmissionMethods(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({ method: "portal", name: "PIEE" }));
    expect(result[1]).toEqual(expect.objectContaining({ method: "email", email: "backup@agency.mil" }));
  });

  it("deduplicates the same address mentioned twice", () => {
    const text =
      "Submit your quote to jane.doe@agency.mil. Quotes sent elsewhere than jane.doe@agency.mil will not be considered.";
    expect(extractSubmissionMethods(text)).toHaveLength(1);
  });
});
