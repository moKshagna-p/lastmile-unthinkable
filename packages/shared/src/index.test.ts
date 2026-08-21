import { describe, expect, test } from "bun:test";
import { canTransition, STATUS_TRANSITIONS } from "./index";

describe("order status lifecycle", () => {
  test("happy path advances one step at a time", () => {
    const happy = ["PLACED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
    for (let i = 0; i < happy.length - 1; i++) {
      expect(canTransition(happy[i], happy[i + 1])).toBe(true);
    }
  });

  test("illegal jumps are rejected", () => {
    expect(canTransition("PLACED", "DELIVERED")).toBe(false);
    expect(canTransition("PLACED", "PICKED_UP")).toBe(false);
    expect(canTransition("IN_TRANSIT", "PLACED")).toBe(false);
    expect(canTransition("DELIVERED", "FAILED")).toBe(false);
    expect(canTransition("CANCELLED", "ASSIGNED")).toBe(false);
  });

  test("failed delivery can only be rescheduled", () => {
    expect(STATUS_TRANSITIONS.FAILED).toEqual(["RESCHEDULED"]);
    expect(canTransition("FAILED", "RESCHEDULED")).toBe(true);
    expect(canTransition("FAILED", "DELIVERED")).toBe(false);
  });

  test("rescheduled orders re-enter the lifecycle via ASSIGNED", () => {
    expect(canTransition("RESCHEDULED", "ASSIGNED")).toBe(true);
  });

  test("terminal states have no outgoing transitions", () => {
    expect(STATUS_TRANSITIONS.DELIVERED).toEqual([]);
    expect(STATUS_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
