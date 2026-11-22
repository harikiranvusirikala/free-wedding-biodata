import { describe, expect, it } from "vitest";
import { INVOCATIONS, invocationParts } from "./invocations";

describe("invocationParts", () => {
  it("spreads the Telugu trio into its three blessings", () => {
    const trio = INVOCATIONS.find((line) => line.id === "teluguBlessing")!.text;
    expect(invocationParts(trio)).toEqual(["శ్రీరస్తు", "శుభమస్తు", "అవిఘ్నమస్తు"]);
  });

  it("splits a typed line of two to four parts joined by a spaced middle dot", () => {
    expect(invocationParts("  Shree ·  Ganesh  ")).toEqual(["Shree", "Ganesh"]);
    expect(invocationParts("a · b · c · d")).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps any other line whole", () => {
    expect(invocationParts("॥ श्री गणेशाय नमः ॥")).toEqual(["॥ श्री गणेशाय नमः ॥"]);
    expect(invocationParts("a·b")).toEqual(["a·b"]);
    expect(invocationParts("a · b · c · d · e")).toEqual(["a · b · c · d · e"]);
    expect(invocationParts(" · x")).toEqual(["· x"]);
  });

  it("gives nothing for an empty line", () => {
    expect(invocationParts("   ")).toEqual([]);
  });
});
