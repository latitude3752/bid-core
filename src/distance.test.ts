import { describe, expect, it } from "vitest";
import { distanceFromZipMiles, haversineMiles, zipCentroid } from "./distance";

describe("haversineMiles", () => {
  it("is zero for the same point", () => {
    expect(haversineMiles(33.75, -84.39, 33.75, -84.39)).toBeCloseTo(0, 1);
  });

  it("matches the well-known Atlanta-to-Chicago great-circle distance", () => {
    // Atlanta, GA -> Chicago, IL is ~587 real-world miles.
    const miles = haversineMiles(33.749, -84.388, 41.8781, -87.6298);
    expect(miles).toBeGreaterThan(560);
    expect(miles).toBeLessThan(610);
  });
});

describe("zipCentroid", () => {
  it("looks up a known ZIP", () => {
    const c = zipCentroid("30301");
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(33.84, 0);
  });

  it("returns null for an unknown or missing ZIP", () => {
    expect(zipCentroid("00000")).toBeNull();
    expect(zipCentroid(null)).toBeNull();
    expect(zipCentroid(undefined)).toBeNull();
  });

  it("uses only the first 5 digits of a ZIP+4", () => {
    expect(zipCentroid("30301-1234")).toEqual(zipCentroid("30301"));
  });
});

describe("distanceFromZipMiles", () => {
  it("computes a plausible distance between two real ZIP codes", () => {
    // Atlanta (30301) to Chicago (60601) -- same real-world pair as above.
    const miles = distanceFromZipMiles("30301", "60601");
    expect(miles).not.toBeNull();
    expect(miles!).toBeGreaterThan(560);
    expect(miles!).toBeLessThan(610);
  });

  it("returns null when either ZIP is unknown", () => {
    expect(distanceFromZipMiles("00000", "30301")).toBeNull();
    expect(distanceFromZipMiles("30301", null)).toBeNull();
  });
});
