import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "./request-ip";

function headersWith(values: Record<string, string>) {
  const map = new Map(Object.entries(values));
  return { get: (name: string) => map.get(name) ?? null };
}

describe("clientIpFromHeaders", () => {
  const originalVercel = process.env.VERCEL;
  const originalTrustProxy = process.env.TRUST_PROXY_HEADERS;

  beforeEach(() => {
    process.env.VERCEL = "1";
    delete process.env.TRUST_PROXY_HEADERS;
  });

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = originalTrustProxy;
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
    delete process.env.VERCEL;
    const h = headersWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    expect(clientIpFromHeaders(h)).toBe("unknown");
  });

  it("trusts these headers off Vercel when a self-hosted operator opts in via TRUST_PROXY_HEADERS", () => {
    delete process.env.VERCEL;
    process.env.TRUST_PROXY_HEADERS = "1";
    const h = headersWith({ "x-real-ip": "9.9.9.9" });
    expect(clientIpFromHeaders(h)).toBe("9.9.9.9");
  });
});
