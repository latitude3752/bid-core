import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIpFromHeaders } from "./request-ip";

function headersWith(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  return { get: (name: string) => map.get(name) ?? null };
}

describe("clientIpFromHeaders", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("TRUST_PROXY_HEADERS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const h = headersWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });

  it("takes the last entry of x-forwarded-for, not the first", () => {
    const h = headersWith({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" });
    expect(clientIpFromHeaders(h)).toBe("2.2.2.2");
  });

  it("fails closed to unknown on a trailing comma rather than an earlier, less-trusted segment", () => {
    const h = headersWith({ "x-forwarded-for": "3.3.3.3," });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });

  it("falls back to unknown when no IP header is present", () => {
    expect(clientIpFromHeaders(headersWith({}))).toBe("unknown");
  });

  it("does not trust these headers off Vercel by default, even if present", () => {
    vi.stubEnv("VERCEL", "");
    const h = headersWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });

  it("does not treat VERCEL=0 as truthy (string-truthiness footgun)", () => {
    vi.stubEnv("VERCEL", "0");
    const h = headersWith({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });

  it("takes the last entry when x-real-ip is set more than once (joined by Headers.get)", () => {
    const h = headersWith({ "x-real-ip": "1.1.1.1, 9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });

  it("fails closed to unknown on a malformed x-real-ip rather than falling through to trust x-forwarded-for", () => {
    const h = headersWith({ "x-real-ip": "3.3.3.3,", "x-forwarded-for": "5.6.7.8" });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });

  it("trusts these headers off Vercel when a self-hosted operator opts in via TRUST_PROXY_HEADERS", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    const h = headersWith({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });

  it("also honors the x-forwarded-for fallback under the TRUST_PROXY_HEADERS opt-in", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    const h = headersWith({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" });
    expect(clientIpFromHeaders(h)).toBe("2.2.2.2");
  });

  it("accepts TRUST_PROXY_HEADERS case-insensitively and trimmed", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY_HEADERS", " True \n");
    const h = headersWith({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });

  it("treats an unrecognized TRUST_PROXY_HEADERS value as unset rather than throwing", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("TRUST_PROXY_HEADERS", "yes");
    const h = headersWith({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });
});
