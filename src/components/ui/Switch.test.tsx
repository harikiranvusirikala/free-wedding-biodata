import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "./Switch";

function Example() {
  const [on, setOn] = useState(false);
  return <Switch checked={on} onChange={setOn} label="Show on the biodata" hint="Hidden fields stay in your draft." />;
}

describe("Switch", () => {
  test("is a switch named by its label, described by its hint, that turns on and off", () => {
    render(<Example />);
    const toggle = screen.getByRole("switch", { name: "Show on the biodata" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(document.getElementById(toggle.getAttribute("aria-describedby")!)?.textContent).toBe("Hidden fields stay in your draft.");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  test("a disabled switch doesn't change", () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Locked" disabled />);
    fireEvent.click(screen.getByRole("switch", { name: "Locked" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
