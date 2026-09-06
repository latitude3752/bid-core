import zipCentroids from "./data/zip-centroids.json";

/** ZIP -> [lat, lon] centroids for ~42,300 US ZIP codes, sourced from the
 * free_zipcode_data public dataset (github.com/midwire/free_zipcode_data).
 * Centroid-level, not rooftop-accurate -- fine for "is this job within
 * driving distance", not for turn-by-turn routing. */
const CENTROIDS = zipCentroids as unknown as Record<string, [number, number]>;

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in miles. */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function zipCentroid(zip: string | null | undefined): [number, number] | null {
  if (!zip) return null;
  const match = zip.match(/^\d{5}/);
  if (!match) return null;
  return CENTROIDS[match[0]] ?? null;
}

/** Miles between two ZIP codes' centroids, or null if either ZIP isn't in
 * the dataset (a bad/foreign value, most often). */
export function distanceFromZipMiles(
  zipA: string | null | undefined,
  zipB: string | null | undefined
): number | null {
  const a = zipCentroid(zipA);
  const b = zipCentroid(zipB);
  if (!a || !b) return null;
  return haversineMiles(a[0], a[1], b[0], b[1]);
}
