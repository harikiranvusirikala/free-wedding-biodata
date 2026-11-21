import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import { Rich } from "./Rich";

describe("Rich", () => {
  test("turns <b> parts into bold elements and leaves the rest as text", () => {
    const { container } = render(
      <p>
        <Rich text="<b>Nothing you enter.</b> The editor talks only to <b>this site</b>." />
      </p>,
    );
    expect(container.querySelectorAll("b")).toHaveLength(2);
    expect(container.textContent).toBe("Nothing you enter. The editor talks only to this site.");
  });

  test("never makes HTML out of anything else", () => {
    const { container } = render(<Rich text={'<img src=x onerror="alert(1)"> and <i>this</i>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)"> and <i>this</i>');
  });
});
