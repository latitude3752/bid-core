import { describe, expect, it } from "vitest";
import { selectActionDigest } from "./action-digest";

describe("selectActionDigest", () => {
  it("keeps the soonest deadlines and reports how many were omitted", () => {
    const items = [
      { id: "late", responseDeadline: "2026-12-01T00:00:00.000Z" },
      { id: "soon", responseDeadline: "2026-09-10T00:00:00.000Z" },
      { id: "none", responseDeadline: null },
    ];
    const { selected, omitted } = selectActionDigest(items, 2);
    expect(selected.map((i) => i.id)).toEqual(["soon", "late"]);
    expect(omitted).toBe(1);
  });

  it("returns all items when under the cap", () => {
    const items = [{ id: "a", responseDeadline: "2026-09-10T00:00:00.000Z" }];
    expect(selectActionDigest(items, 8)).toEqual({ selected: items, omitted: 0 });
  });
});
