import { beforeEach, describe, expect, it, vi } from "vitest";

const selectSingle = vi.fn();
const updateEq = vi.fn();
const updateMock = vi.fn((_payload: unknown) => ({ eq: updateEq }));
const fetchNoticeDescription = vi.fn();

vi.mock("./supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: selectSingle }) }),
      update: (payload: unknown) => updateMock(payload),
    }),
  }),
}));

vi.mock("./notice-description", () => ({ fetchNoticeDescription }));

const { ensureOpportunityScale } = await import("./ensure-scale");

describe("ensureOpportunityScale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEq.mockResolvedValue({ error: null });
  });

  it("surfaces a description-fetch failure instead of swallowing it silently", async () => {
    selectSingle.mockResolvedValue({
      data: {
        id: "opp-1",
        title: "Landscaping services",
        raw_data: { description: "https://api.sam.gov/notice/1" },
        requirements_text: null,
        requirements_fetched_at: null,
        program_type: null,
        estimated_ceiling: null,
        scale_checked_at: null,
      },
      error: null,
    });
    fetchNoticeDescription.mockRejectedValueOnce(new Error("Notice description fetch failed: 429"));

    const result = await ensureOpportunityScale("opp-1", { force: true });

    expect(result.descriptionFetchError).toMatch(/429/);
    expect(result.fetchedAt).toBeNull();
    // Title alone still gets classified -- a failed fetch isn't fatal to the caller.
    expect(updateEq).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
    const failedPatch = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(failedPatch).not.toHaveProperty("scale_checked_at");
  });

  it("retries a failed description fetch on the next unforced call instead of treating it as cached success", async () => {
    const row = {
      id: "opp-3",
      title: "Landscaping services",
      raw_data: { description: "https://api.sam.gov/notice/3" },
      requirements_text: null,
      requirements_fetched_at: null,
      program_type: null,
      estimated_ceiling: null,
      scale_checked_at: null,
    };
    selectSingle.mockResolvedValue({ data: row, error: null });
    fetchNoticeDescription
      .mockRejectedValueOnce(new Error("Notice description fetch failed: 429"))
      .mockResolvedValueOnce("Full notice text.");

    const first = await ensureOpportunityScale("opp-3");
    expect(first.descriptionFetchError).toMatch(/429/);
    expect(fetchNoticeDescription).toHaveBeenCalledTimes(1);
    const failedPatch = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(failedPatch).not.toHaveProperty("scale_checked_at");

    const second = await ensureOpportunityScale("opp-3");
    expect(fetchNoticeDescription).toHaveBeenCalledTimes(2);
    expect(second.descriptionFetchError).toBeNull();
    expect(second.text).toBe("Full notice text.");
    const successPatch = updateMock.mock.calls[1][0] as Record<string, unknown>;
    expect(successPatch.scale_checked_at).toEqual(expect.any(String));
  });

  it("reports no error when the description fetch succeeds", async () => {
    selectSingle.mockResolvedValue({
      data: {
        id: "opp-2",
        title: "Landscaping services",
        raw_data: { description: "https://api.sam.gov/notice/2" },
        requirements_text: null,
        requirements_fetched_at: null,
        program_type: null,
        estimated_ceiling: null,
        scale_checked_at: null,
      },
      error: null,
    });
    fetchNoticeDescription.mockResolvedValueOnce("Full notice text.");

    const result = await ensureOpportunityScale("opp-2", { force: true });

    expect(result.descriptionFetchError).toBeNull();
    expect(result.text).toBe("Full notice text.");
    expect(result.fetchedAt).not.toBeNull();
  });
});
