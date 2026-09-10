import { describe, expect, it } from "vitest";
import { extractSubmissionMethod } from "./submission-method";

describe("extractSubmissionMethod", () => {
  it("finds an email instruction stated before the address", () => {
    const text = "Quotes shall be emailed to jane.doe@agency.mil no later than the closing date.";
    expect(extractSubmissionMethod(text)).toEqual({ method: "email", email: "jane.doe@agency.mil" });
  });

  it("finds an email instruction stated after the address", () => {
    const text = "Send your response to john.smith@agency.gov -- quotations submitted elsewhere will not be considered.";
    expect(extractSubmissionMethod(text)).toEqual({ method: "email", email: "john.smith@agency.gov" });
  });

  it("ignores a point-of-contact email with no submission language nearby", () => {
    const text = "For questions about this solicitation, email jane.doe@agency.mil.";
    expect(extractSubmissionMethod(text)).toBeNull();
  });

  it("strips trailing punctuation from the captured address", () => {
    const text = "Submit your quote via email to jane.doe@agency.mil.";
    expect(extractSubmissionMethod(text)).toEqual({ method: "email", email: "jane.doe@agency.mil" });
  });

  it("returns null for missing text", () => {
    expect(extractSubmissionMethod(null)).toBeNull();
    expect(extractSubmissionMethod(undefined)).toBeNull();
    expect(extractSubmissionMethod("")).toBeNull();
  });

  it("returns null when no email address is present at all", () => {
    expect(extractSubmissionMethod("Submit your quote through PIEE by the closing date.")).toBeNull();
  });
});
