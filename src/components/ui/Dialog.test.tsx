import { Activity, useState } from "react";
import { describe, expect, test } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog } from "./Dialog";

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rename
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Rename this draft" description="Only you see this name.">
        <input aria-label="Name" />
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </Dialog>
    </>
  );
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Rename" }));
const dialog = () => document.querySelector("dialog")!;

describe("Dialog", () => {
  test("opens as a modal named by its heading, with the description, and focuses the first field", () => {
    render(<Example />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull(); // nothing inside until it opens
    open();
    expect(dialog().open).toBe(true);
    expect(screen.getByRole("dialog", { name: "Rename this draft" })).toBeDefined();
    expect(screen.getByText("Only you see this name.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
  });

  test("Close, Escape, the content's own button and a click on the backdrop end it; a click inside doesn't", () => {
    render(<Example />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog().open).toBe(false);

    open();
    fireEvent(dialog(), new Event("cancel", { cancelable: true })); // what Escape sends
    expect(dialog().open).toBe(false);

    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog().open).toBe(false);

    open();
    fireEvent.click(screen.getByText("Only you see this name."));
    expect(dialog().open).toBe(true);
    fireEvent.click(dialog()); // the backdrop around the box
    expect(dialog().open).toBe(false);
  });

  test("hiding its page closes it (a modal left open would make the next page inert)", () => {
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <Example />
      </Activity>
    );
    const { rerender } = render(page("visible"));
    open();
    expect(dialog().open).toBe(true);
    rerender(page("hidden"));
    expect(dialog().open).toBe(false);
  });
});
