import "server-only";

/** Strips HTML tags/entities from SAM.gov notice description text (some
 * agencies post prose wrapped in <p> tags; others post plain text). */
export function cleanDescriptionText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetches a SAM.gov opportunity's full description text via the URL stored
 * in raw_data.description (needs &api_key= appended). */
export async function fetchNoticeDescription(descriptionUrl: string): Promise<string> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error("SAM_GOV_API_KEY is not set");

  const url = descriptionUrl.includes("api_key=")
    ? descriptionUrl
    : `${descriptionUrl}${descriptionUrl.includes("?") ? "&" : "?"}api_key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Notice description fetch failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data?.description) throw new Error("No description available for this notice");
  return cleanDescriptionText(data.description);
}
