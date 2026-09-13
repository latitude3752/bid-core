import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POSTED_LOOKBACK_DAYS,
  RESPONSE_DEADLINE_HORIZON_DAYS,
  SamGovQuotaExceededError,
  opportunitySearchWindow,
  searchOpportunitiesByKeyword,
  searchOpportunitiesByNaics,
  searchOpportunitiesBySetAside,
} from "./sam-gov";

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as Response;
}

describe("opportunitySearchWindow", () => {
  it("covers response deadlines from today through +90 days", () => {
    const now = new Date("2026-08-25T13:00:00.000Z");
    const window = opportunitySearchWindow(now);

    expect(RESPONSE_DEADLINE_HORIZON_DAYS).toBe(90);
    expect(window.rdlfrom).toBe("08/25/2026");
    expect(window.rdlto).toBe("11/23/2026");
    expect(window.postedTo).toBe("08/25/2026");
    expect(window.postedFrom).toBe("11/28/2025");
    expect(POSTED_LOOKBACK_DAYS).toBe(270);
  });

  it("keeps postedFrom through rdlto within SAM's 1-year cap", () => {
    const window = opportunitySearchWindow(new Date("2026-08-25T13:00:00.000Z"));
    const parse = (s: string) => {
      const [mm, dd, yyyy] = s.split("/").map(Number);
      return Date.UTC(yyyy, mm - 1, dd);
    };
    const spanDays = (parse(window.rdlto) - parse(window.postedFrom)) / 86_400_000;
    expect(spanDays).toBeLessThanOrEqual(365);
  });

  it("crosses month and year boundaries for the +90 day deadline", () => {
    const window = opportunitySearchWindow(new Date("2026-12-15T00:00:00.000Z"));
    expect(window.rdlfrom).toBe("12/15/2026");
    expect(window.rdlto).toBe("03/15/2027");
  });
});

describe("SAM.gov opportunity search", () => {
  beforeEach(() => {
    process.env.SAM_GOV_API_KEY = "test-key";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T13:00:00.000Z"));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.SAM_GOV_API_KEY;
  });

  it("sends rdlfrom/rdlto covering today through +90 days", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ totalRecords: 1, opportunitiesData: [{ noticeId: "n1" }] })
    );

    await searchOpportunitiesByNaics("336411");

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("ncode")).toBe("336411");
    expect(url.searchParams.get("status")).toBe("active");
    expect(url.searchParams.get("rdlfrom")).toBe("08/25/2026");
    expect(url.searchParams.get("rdlto")).toBe("11/23/2026");
    expect(url.searchParams.get("postedFrom")).toBe("11/28/2025");
    expect(url.searchParams.get("postedTo")).toBe("08/25/2026");
    expect(url.searchParams.get("limit")).toBe("1000");
    expect(url.searchParams.get("offset")).toBe("0");
    expect(url.searchParams.get("api_key")).toBe("test-key");
  });

  it("passes set-aside code with the same deadline window", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ totalRecords: 0, opportunitiesData: [] })
    );

    await searchOpportunitiesBySetAside("SDVOSBC");

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("typeOfSetAside")).toBe("SDVOSBC");
    expect(url.searchParams.get("rdlfrom")).toBe("08/25/2026");
    expect(url.searchParams.get("rdlto")).toBe("11/23/2026");
  });

  it("passes a title keyword with no NAICS restriction", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ totalRecords: 0, opportunitiesData: [] })
    );

    await searchOpportunitiesByKeyword("counter-UAS");

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("title")).toBe("counter-UAS");
    expect(url.searchParams.get("ncode")).toBeNull();
  });

  it("pages by zero-based page index until all records are collected", async () => {
    const page0 = [{ noticeId: "a" }, { noticeId: "b" }];
    const page1 = [{ noticeId: "c" }];
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ totalRecords: 3, opportunitiesData: page0 }))
      .mockResolvedValueOnce(jsonResponse({ totalRecords: 3, opportunitiesData: page1 }));

    const results = await searchOpportunitiesByNaics("336411", { pageLimit: 2 });

    expect(results.map((r) => r.noticeId)).toEqual(["a", "b", "c"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const first = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    const second = new URL(String(vi.mocked(fetch).mock.calls[1][0]));
    expect(first.searchParams.get("offset")).toBe("0");
    expect(first.searchParams.get("limit")).toBe("2");
    expect(second.searchParams.get("offset")).toBe("1");
  });

  it("drops notices whose response deadline is past the +90 day horizon", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        totalRecords: 2,
        opportunitiesData: [
          { noticeId: "in", responseDeadLine: "2026-11-23T13:00:00.000Z" },
          { noticeId: "out", responseDeadLine: "2031-08-03T22:00:00.000Z" },
        ],
      })
    );

    const results = await searchOpportunitiesByNaics("336411");
    expect(results.map((r) => r.noticeId)).toEqual(["in"]);
  });

  it("throws when SAM_GOV_API_KEY is missing", async () => {
    delete process.env.SAM_GOV_API_KEY;
    await expect(searchOpportunitiesByNaics("336411")).rejects.toThrow(
      "SAM_GOV_API_KEY is not set"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws SamGovQuotaExceededError on a 429 quota response, distinct from other errors", async () => {
    vi.mocked(fetch).mockResolvedValue(
      errorResponse(429, '{"message":"You have exceeded your quota."}')
    );
    await expect(searchOpportunitiesByNaics("336411")).rejects.toBeInstanceOf(
      SamGovQuotaExceededError
    );
  });

  it("throws a plain error when a 5xx failure persists through the retry", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(503, "Service unavailable"));
    const result = expect(searchOpportunitiesByNaics("336411")).rejects.not.toBeInstanceOf(
      SamGovQuotaExceededError
    );
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("recovers from a single transient 5xx by retrying once (Sep 12 audit: rotating 504s)", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(errorResponse(504, "Gateway Time-out"))
      .mockResolvedValueOnce(jsonResponse({ totalRecords: 1, opportunitiesData: [{ noticeId: "n1" }] }));

    const resultPromise = searchOpportunitiesByNaics("336411");
    await vi.advanceTimersByTimeAsync(1000);
    const results = await resultPromise;

    expect(results.map((r) => r.noticeId)).toEqual(["n1"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx (including 429 quota) response", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(429, '{"message":"exceeded quota"}'));
    await expect(searchOpportunitiesByNaics("336411")).rejects.toBeInstanceOf(
      SamGovQuotaExceededError
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
