import { describe, expect, it } from "vitest";
import { classifyProgramType, extractProgramCeiling } from "./program-scale";

describe("extractProgramCeiling", () => {
  it("finds a ceiling stated before the dollar amount", () => {
    const text = "This is a Firm-Fixed-Price BPA. The BPA ceiling is $25,000,000.00 over 60 months.";
    expect(extractProgramCeiling(text)).toBe(25_000_000);
  });

  it("finds a ceiling stated after the dollar amount", () => {
    const text = "Total value of orders under this IDIQ shall not exceed $2,500,000 (the contract ceiling).";
    expect(extractProgramCeiling(text)).toBe(2_500_000);
  });

  it("ignores ordinary line-item prices with no ceiling language nearby", () => {
    const text =
      "CLIN 0001 unit price $4,950.00 each. CLIN 0002 unit price $3,950.00 each. First order total $627,115.00.";
    expect(extractProgramCeiling(text)).toBeNull();
  });

  it("picks the largest ceiling figure when more than one is mentioned", () => {
    const text = "Base year not to exceed $500,000. Total contract ceiling across all option years: $2,000,000.";
    expect(extractProgramCeiling(text)).toBe(2_000_000);
  });

  it("returns null for missing text", () => {
    expect(extractProgramCeiling(null)).toBeNull();
    expect(extractProgramCeiling(undefined)).toBeNull();
    expect(extractProgramCeiling("")).toBeNull();
  });

  it("scales a 'million' ceiling instead of reading only the leading digits", () => {
    expect(extractProgramCeiling("The estimated annual value is $50 million across all task orders.")).toBe(
      50_000_000
    );
  });

  it("scales an abbreviated M/K suffix", () => {
    expect(extractProgramCeiling("IDIQ ceiling $2.5M over the base and option periods.")).toBe(2_500_000);
    expect(extractProgramCeiling("Program ceiling not to exceed $750K annually.")).toBe(750_000);
  });

  it("still picks the largest ceiling when mixing plain and scaled figures", () => {
    const text = "Base year not to exceed $500,000. Total contract ceiling across all option years: $2 million.";
    expect(extractProgramCeiling(text)).toBe(2_000_000);
  });
});

describe("classifyProgramType", () => {
  it("recognizes a BPA", () => {
    expect(classifyProgramType("Instrument offered: Firm-Fixed-Price Blanket Purchase Agreement (BPA)")).toBe("bpa");
    expect(classifyProgramType("This solicitation will result in a BPA.")).toBe("bpa");
  });

  it("recognizes an IDIQ", () => {
    expect(classifyProgramType("Award will be an Indefinite-Delivery Indefinite-Quantity contract.")).toBe("idiq");
    expect(classifyProgramType("IDIQ ceiling $2,000,000")).toBe("idiq");
  });

  it("returns null for an ordinary RFQ with no program-vehicle language", () => {
    expect(classifyProgramType("Line 0001 Qty 22 UI EA Deliver To: Jacksonville, FL By: 361 DAYS ARO")).toBeNull();
  });

  it("returns null for missing text", () => {
    expect(classifyProgramType(null)).toBeNull();
    expect(classifyProgramType(undefined)).toBeNull();
  });
});
