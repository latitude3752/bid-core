import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const selectEq = vi.fn();

vi.mock("./supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: selectEq }) }),
  }),
}));

const { recordSamGovUsage, getSamGovUsageToday, reportSamGovUsage } = await import("./sam-gov-usage");

describe("recordSamGovUsage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the increment RPC with today's date", async () => {
    rpc.mockResolvedValue({ error: null });

    await recordSamGovUsage("bidyard", 1);

    expect(rpc).toHaveBeenCalledWith(
      "increment_sam_gov_usage",
      expect.objectContaining({ p_app: "bidyard", p_count: 1 })
    );
  });

  it("throws on a database error instead of silently dropping the count", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });

    await expect(recordSamGovUsage("bidyard", 1)).rejects.toThrow("boom");
  });
});

describe("getSamGovUsageToday", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums per-app rows into a combined total", async () => {
    selectEq.mockResolvedValue({
      data: [
        { app: "bidhawk", call_date: "2026-09-09", count: 90 },
        { app: "bidyard", call_date: "2026-09-09", count: 12 },
      ],
      error: null,
    });

    const result = await getSamGovUsageToday();

    expect(result.total).toBe(102);
    expect(result.rows).toHaveLength(2);
  });
});

describe("reportSamGovUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("never throws even when the hub is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(reportSamGovUsage("https://trybidhawk.com", "bidyard", 1)).resolves.toBeUndefined();
  });

  it("posts the app and count to the hub's report endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await reportSamGovUsage("https://trybidhawk.com", "bidyard", 1);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://trybidhawk.com/api/sam-usage/report",
      expect.objectContaining({ method: "POST" })
    );
  });
});
