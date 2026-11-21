import { useState } from "react";
import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
  { value: "xl", label: "Huge", disabled: true },
] as const;

function Example() {
  const [value, setValue] = useState<(typeof OPTIONS)[number]["value"]>("m");
  return <SegmentedControl label="Text size" value={value} options={OPTIONS} onChange={setValue} />;
}

const radio = (name: string) => screen.getByRole("radio", { name });

describe("SegmentedControl", () => {
  test("is a radio group with the chosen option checked and the only one Tab reaches", () => {
    render(<Example />);
    expect(screen.getByRole("radiogroup", { name: "Text size" })).toBeDefined();
    expect(radio("Medium").getAttribute("aria-checked")).toBe("true");
    expect(radio("Small").getAttribute("aria-checked")).toBe("false");
    expect(radio("Medium").tabIndex).toBe(0);
    expect(radio("Small").tabIndex).toBe(-1);
  });

  test("a click chooses", () => {
    render(<Example />);
    fireEvent.click(radio("Large"));
    expect(radio("Large").getAttribute("aria-checked")).toBe("true");
    expect(radio("Medium").getAttribute("aria-checked")).toBe("false");
  });

  test("arrows, Home and End move and choose, skipping disabled options and wrapping round", () => {
    render(<Example />);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(radio("Large").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("Large"));
    fireEvent.keyDown(group, { key: "ArrowRight" }); // Huge is disabled: round to Small
    expect(radio("Small").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(radio("Large").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "Home" });
    expect(radio("Small").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "End" });
    expect(radio("Large").getAttribute("aria-checked")).toBe("true");
  });
});
