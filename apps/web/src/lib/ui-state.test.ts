import { describe, expect, test } from "bun:test";
import { activeNavHref, orderStepForScroll } from "./ui-state";

describe("activeNavHref", () => {
  const customerLinks = ["/app", "/app/new"];

  test("uses the most specific matching route", () => {
    expect(activeNavHref("/app/new", customerLinks)).toBe("/app/new");
    expect(activeNavHref("/app/orders/123", customerLinks)).toBe("/app");
  });
});

describe("orderStepForScroll", () => {
  test("tracks route, package, and confirm sections", () => {
    expect(orderStepForScroll({ packageTop: 700, confirmTop: null })).toBe("route");
    expect(orderStepForScroll({ packageTop: 120, confirmTop: null })).toBe("package");
    expect(orderStepForScroll({ packageTop: -500, confirmTop: 120 })).toBe("confirm");
  });
});
