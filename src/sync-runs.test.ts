import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: number;
  source: string;
  fetched: number | null;
  upserted: number;
  error_count: number;
  errors: string[];
  ran_at: string;
};

let rows: Row[] = [];
let insertError: { message: string } | null = null;
const insert = vi.fn(async (row: Record<string, unknown>) => {
  rows.push({ id: rows.length + 1, ...row } as Row);
  return { error: insertError };
});

/** Minimal chainable query builder covering exactly what sync-runs.ts
 * calls: select(...).in(...)?.eq(...)?.order(...).limit(...).maybeSingle()
 * or a bare select(...).order(...).limit(...) (no maybeSingle, no `.in`). */
function makeQuery() {
  let filtered = rows.slice();
  const builder = {
    in(_col: string, values: string[]) {
      filtered = filtered.filter((r) => values.includes(r.source));
      return builder;
    },
    eq(col: string, value: unknown) {
      filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === value);
      return builder;
    },
    order(_col: string, opts?: { ascending?: boolean }) {
      filtered = filtered
        .slice()
        .sort((a, b) => (opts?.ascending ? 1 : -1) * (a.ran_at < b.ran_at ? -1 : 1));
      return builder;
    },
    limit(n: number) {
      filtered = filtered.slice(0, n);
      return builder;
    },
    async maybeSingle() {
      return { data: filtered[0] ?? null, error: null };
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      resolve({ data: filtered, error: null });
    },
  };
  return builder;
}

vi.mock("./supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert,
      select: () => makeQuery(),
    }),
  }),
}));

const { recordSyncRun, listRecentSyncRuns, lastSuccessfulSyncRun, sourceHealthSummary } = await import(
  "./sync-runs"
);

describe("recordSyncRun", () => {
  beforeEach(() => {
    rows = [];
    insertError = null;
    insert.mockClear();
  });

  it("stores fetched alongside upserted and errors", async () => {
    await recordSyncRun({ source: "gpr", fetched: 12, upserted: 10, errors: [] });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "gpr", fetched: 12, upserted: 10, error_count: 0 })
    );
  });

  it("defaults fetched to null when omitted (legacy direct/relay callers)", async () => {
    await recordSyncRun({ source: "direct", upserted: 5, errors: [] });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ fetched: null }));
  });

  it("never throws when the insert fails", async () => {
    insertError = { message: "connection reset" };

    await expect(recordSyncRun({ source: "gpr", upserted: 0, errors: [] })).resolves.toBeUndefined();
  });
});

describe("listRecentSyncRuns", () => {
  beforeEach(() => {
    rows = [
      { id: 1, source: "gpr", fetched: 3, upserted: 3, error_count: 0, errors: [], ran_at: "2026-09-11T10:00:00Z" },
      { id: 2, source: "direct", fetched: null, upserted: 8, error_count: 0, errors: [], ran_at: "2026-09-11T11:00:00Z" },
    ];
  });

  it("filters to the requested sources when given", async () => {
    const result = await listRecentSyncRuns(20, ["gpr"]);

    expect(result.map((r) => r.source)).toEqual(["gpr"]);
  });

  it("returns every source when none is given", async () => {
    const result = await listRecentSyncRuns(20);

    expect(result).toHaveLength(2);
  });
});

describe("lastSuccessfulSyncRun", () => {
  beforeEach(() => {
    rows = [
      { id: 1, source: "gpr", fetched: 3, upserted: 3, error_count: 0, errors: [], ran_at: "2026-09-11T09:00:00Z" },
      { id: 2, source: "direct", fetched: null, upserted: 0, error_count: 1, errors: ["boom"], ran_at: "2026-09-11T11:00:00Z" },
    ];
  });

  it("scopes to the given sources so an unrelated source's success can't mask a stale one", async () => {
    const result = await lastSuccessfulSyncRun(["direct", "relay"]);

    expect(result).toBeNull();
  });

  it("finds the latest zero-error run across all sources when unscoped", async () => {
    const result = await lastSuccessfulSyncRun();

    expect(result?.source).toBe("gpr");
  });
});

describe("sourceHealthSummary", () => {
  beforeEach(() => {
    rows = [
      { id: 1, source: "direct", fetched: null, upserted: 8, error_count: 0, errors: [], ran_at: "2026-09-11T08:00:00Z" },
      { id: 2, source: "relay", fetched: null, upserted: 8, error_count: 0, errors: [], ran_at: "2026-09-11T08:05:00Z" },
      { id: 3, source: "gpr", fetched: 0, upserted: 0, error_count: 1, errors: ["HTTP 500"], ran_at: "2026-09-11T09:00:00Z" },
    ];
  });

  it("merges multiple sources into one group and reports the latest run per group", async () => {
    const [samGov, gpr] = await sourceHealthSummary([
      { label: "SAM.gov", sources: ["direct", "relay"] },
      { label: "Georgia", sources: ["gpr"] },
    ]);

    expect(samGov.lastRun?.source).toBe("relay");
    expect(samGov.lastSuccess?.source).toBe("relay");
    expect(gpr.lastRun?.error_count).toBe(1);
    expect(gpr.lastSuccess).toBeNull();
  });
});
