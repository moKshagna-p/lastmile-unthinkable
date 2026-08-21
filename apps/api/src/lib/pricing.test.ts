import { describe, expect, test } from "bun:test";
import { billableWeight, volumetricWeight } from "./pricing";

describe("billable weight — higher of actual vs volumetric", () => {
  test("volumetric wins when the box is light but bulky", () => {
    const vol = volumetricWeight(40, 40, 40); // 12.8 kg
    expect(billableWeight(2, vol)).toBe(13); // rounded up to next 0.5 slab
  });

  test("actual weight wins when dense", () => {
    expect(billableWeight(9.4, 1.2)).toBe(9.5);
  });

  test("exact slabs are not rounded up", () => {
    expect(billableWeight(2, 2)).toBe(2);
    expect(billableWeight(0.5, 0.25)).toBe(0.5);
  });

  test("fractional weights round up to the next half-kilo", () => {
    expect(billableWeight(1.21, 0)).toBe(1.5);
    expect(billableWeight(3.01, 0)).toBe(3.5);
  });
});
