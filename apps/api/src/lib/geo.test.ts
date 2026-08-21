import { describe, expect, test } from "bun:test";
import { haversineKm } from "./geo";

describe("haversine distance", () => {
  test("zero distance for identical points", () => {
    expect(haversineKm(12.97, 77.6, 12.97, 77.6)).toBe(0);
  });

  test("symmetric in both directions", () => {
    const ab = haversineKm(12.9756, 77.6068, 12.8452, 77.6602);
    const ba = haversineKm(12.8452, 77.6602, 12.9756, 77.6068);
    expect(ab).toBeCloseTo(ba, 6);
  });

  test("MG Road → Electronic City is a plausible Bengaluru hop (~15 km)", () => {
    const d = haversineKm(12.9756, 77.6068, 12.8452, 77.6602);
    expect(d).toBeGreaterThan(13);
    expect(d).toBeLessThan(18);
  });

  test("Indiranagar → Hebbal stays within the default dispatch radius (~7 km)", () => {
    const d = haversineKm(12.9784, 77.6408, 13.0358, 77.597);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(10);
  });
});
