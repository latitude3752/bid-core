import { describe, expect, it } from "vitest";
import { accessDecision } from "./access-decision";

describe("accessDecision", () => {
  it("treats marketing and auth pages as public", () => {
    expect(accessDecision("/")).toBe("public");
    expect(accessDecision("/start")).toBe("public");
    expect(accessDecision("/login")).toBe("public");
    expect(accessDecision("/admin/login")).toBe("public");
    expect(accessDecision("/opportunities")).toBe("public");
  });

  it("gates founder admin", () => {
    expect(accessDecision("/admin/opportunities")).toBe("founder");
    expect(accessDecision("/admin/subscribers")).toBe("founder");
  });

  it("gates the subscriber app", () => {
    expect(accessDecision("/app/opportunities")).toBe("subscriber");
    expect(accessDecision("/app/grants")).toBe("subscriber");
  });
});
