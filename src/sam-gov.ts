import "server-only";
import { isWithinDeadlineHorizon } from "./deadline";

const SAM_GOV_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";

/** Include notices whose response deadline is on or before today + this many days. */
export const RESPONSE_DEADLINE_HORIZON_DAYS = 90;

/** Posted-date lookback. SAM requires postedFrom/postedTo and caps any date
 * span at 1 year. Combined from postedFrom through rdlto (today+90) must stay
 * inside that cap, so lookback is 1 year minus the deadline horizon, minus a
 * small pad for inclusive calendar-day counting. */
export const POSTED_LOOKBACK_DAYS =
  365 - RESPONSE_DEADLINE_HORIZON_DAYS - 5;

/** SAM max records per page. */
export const SAM_PAGE_LIMIT = 1000;

const MAX_PAGES = 10;

export type SamGovPlaceOfPerformance = {
  city?: { code?: string; name?: string };
  state?: { code?: string; name?: string };
  zip?: string;
  country?: { code?: string; name?: string };
} | null;

export type SamGovOpportunity = {
  noticeId: string;
  title: string;
  fullParentPathName: string | null;
  naicsCode: string | null;
  setAsideCode: string | null;
  typeOfSetAsideDescription: string | null;
  responseDeadLine: string | null;
  postedDate: string | null;
  uiLink: string | null;
  type: string | null;
  classificationCode: string | null;
  placeOfPerformance?: SamGovPlaceOfPerformance;
};

export type OpportunitySearchOptions = {
  postedLookbackDays?: number;
  responseDeadlineHorizonDays?: number;
  pageLimit?: number;
  now?: Date;
};

export type OpportunitySearchWindow = {
  postedFrom: string;
  postedTo: string;
  rdlfrom: string;
  rdlto: string;
};

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatSamDate(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getUTCFullYear()}`;
}

/** SAM.gov posted-date + response-deadline window: due dates from today
 * through today + 90 days, posted within the last year (API max). */
export function opportunitySearchWindow(
  now = new Date(),
  options: Pick<
    OpportunitySearchOptions,
    "postedLookbackDays" | "responseDeadlineHorizonDays"
  > = {}
): OpportunitySearchWindow {
  const postedLookbackDays = options.postedLookbackDays ?? POSTED_LOOKBACK_DAYS;
  const responseDeadlineHorizonDays =
    options.responseDeadlineHorizonDays ?? RESPONSE_DEADLINE_HORIZON_DAYS;

  return {
    postedFrom: formatSamDate(addUtcDays(now, -postedLookbackDays)),
    postedTo: formatSamDate(now),
    rdlfrom: formatSamDate(now),
    rdlto: formatSamDate(addUtcDays(now, responseDeadlineHorizonDays)),
  };
}

type SamSearchResponse = {
  totalRecords?: number;
  opportunitiesData?: SamGovOpportunity[];
};

/** Thrown when SAM.gov reports the API key's daily quota is exhausted (HTTP
 * 429 with a "quota" message, distinct from a transient rate limit or a
 * one-off 5xx). Every remaining call today would fail the same way, so
 * callers should stop looping over the rest of their NAICS/keyword list
 * instead of burning a failed request per remaining item. */
export class SamGovQuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SamGovQuotaExceededError";
  }
}

function isQuotaExceeded(status: number, body: string): boolean {
  return status === 429 && /exceeded.{0,20}quota/i.test(body);
}

const SAM_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SAM.gov's search endpoint occasionally 504s on an otherwise-valid query --
 * confirmed live in BidHawk's sync history: a different NAICS code or
 * keyword timed out on five separate days, never the same one twice, which
 * is upstream flakiness rather than a broken query. A single retry after a
 * short delay clears nearly all of these. 4xx responses (429 quota
 * included) are never retried -- a second attempt would fail identically,
 * and quota-exceeded is handled by the caller instead. */
async function fetchSamGovPage(url: string): Promise<Response> {
  const res = await fetch(url);
  if (res.ok || res.status < 500) return res;
  await sleep(SAM_RETRY_DELAY_MS);
  return fetch(url);
}

async function searchOpportunities(
  extraParams: Record<string, string>,
  options: OpportunitySearchOptions = {}
): Promise<SamGovOpportunity[]> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error("SAM_GOV_API_KEY is not set");

  const now = options.now ?? new Date();
  const window = opportunitySearchWindow(now, options);
  const pageLimit = options.pageLimit ?? SAM_PAGE_LIMIT;
  const collected: SamGovOpportunity[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      api_key: apiKey,
      status: "active",
      postedFrom: window.postedFrom,
      postedTo: window.postedTo,
      rdlfrom: window.rdlfrom,
      rdlto: window.rdlto,
      limit: String(pageLimit),
      offset: String(page),
      ...extraParams,
    });

    const res = await fetchSamGovPage(`${SAM_GOV_SEARCH_URL}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      if (isQuotaExceeded(res.status, body)) {
        throw new SamGovQuotaExceededError(`SAM.gov API error ${res.status}: ${body}`);
      }
      throw new Error(`SAM.gov API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as SamSearchResponse;
    const pageRows = data.opportunitiesData ?? [];
    if (pageRows.length === 0) break;

    for (const row of pageRows) {
      if (!row.noticeId || seen.has(row.noticeId)) continue;
      seen.add(row.noticeId);
      collected.push(row);
    }

    const total = typeof data.totalRecords === "number" ? data.totalRecords : collected.length;
    if (pageRows.length < pageLimit || collected.length >= total) break;
  }

  const horizonDays = options.responseDeadlineHorizonDays ?? RESPONSE_DEADLINE_HORIZON_DAYS;
  return collected.filter((op) => isWithinDeadlineHorizon(op.responseDeadLine, now, horizonDays));
}

/** Fetches active SAM.gov opportunities for a NAICS code whose response
 * deadline falls between today and today + 90 days. */
export async function searchOpportunitiesByNaics(
  naicsCode: string,
  options: OpportunitySearchOptions = {}
): Promise<SamGovOpportunity[]> {
  return searchOpportunities({ ncode: naicsCode }, options);
}

/** Fetches active SAM.gov opportunities for a set-aside code, with NO NAICS
 * restriction. Same +90-day response-deadline window as the NAICS search. */
export async function searchOpportunitiesBySetAside(
  setAsideCode: string,
  options: OpportunitySearchOptions = {}
): Promise<SamGovOpportunity[]> {
  return searchOpportunities({ typeOfSetAside: setAsideCode }, options);
}

/** Fetches active SAM.gov opportunities whose TITLE matches a keyword, with
 * NO NAICS restriction -- SAM.gov's `title` search param only matches the
 * notice title, not the full description, but that's enough to catch a
 * miscoded NAICS that a NAICS-code search alone would miss. Used by BidHawk's
 * wide-net UAS/counter-UAS keyword pass; siblings without a keyword layer
 * simply don't call this. */
export async function searchOpportunitiesByKeyword(
  keyword: string,
  options: OpportunitySearchOptions = {}
): Promise<SamGovOpportunity[]> {
  return searchOpportunities({ title: keyword }, options);
}
