import { beforeEach, describe, expect, it, vi } from "vitest";

const selectSingle = vi.fn();
const updateEq = vi.fn();
const fetchNoticeDescription = vi.fn();

vi.mock("./supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: selectSingle }) }),
      update: () => ({ eq: updateEq }),
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
