import { describe, expect, it } from "vitest";
import { formatDeadlineWithZone } from "./deadline";

describe("formatDeadlineWithZone", () => {
  it("renders date, time, and zone converted to Eastern", () => {
    // 20:00 UTC on Sep 17, 2026 is 4:00 PM EDT.
    expect(formatDeadlineWithZone("2026-09-17T20:00:00.000Z")).toBe("Sep 17, 2026, 4:00 PM EDT");
  });

  it("converts to Eastern Standard Time outside daylight saving", () => {
    // 20:00 UTC on Jan 15, 2026 is 3:00 PM EST.
    expect(formatDeadlineWithZone("2026-01-15T20:00:00.000Z")).toBe("Jan 15, 2026, 3:00 PM EST");
  });

  it("returns an honest empty for missing or unparseable input", () => {
    expect(formatDeadlineWithZone(null)).toBe("no deadline listed");
    expect(formatDeadlineWithZone(undefined)).toBe("no deadline listed");
    expect(formatDeadlineWithZone("not a date")).toBe("no deadline listed");
  });
});
