import { describe, expect, it } from "vitest";
import { fontFamilies, normalizeSvgIds, resolveAlign, transformText } from "./display-list";

// The reader itself needs a real layout (Range.getClientRects), so it is checked in the browser by e2e/pdf.spec.ts
// (baselines, alignment, justification, spaces between runs, italic, fallback); these are its pure parts.

describe("fontFamilies", () => {
  it("keeps the whole stack without quotes or generic families", () => {
    expect(fontFamilies(`"Noto Sans Kannada", "Noto Sans", sans-serif`)).toEqual(["Noto Sans Kannada", "Noto Sans"]);
    expect(fontFamilies(`'Noto Sans', system-ui`)).toEqual(["Noto Sans"]);
  });
});

describe("resolveAlign", () => {
  it("maps computed text-align values", () => {
    expect(resolveAlign("start")).toBe("left");
    expect(resolveAlign("end")).toBe("right");
    expect(resolveAlign("-webkit-center")).toBe("center");
    expect(resolveAlign("justify")).toBe("justify");
    expect(resolveAlign("start", "rtl")).toBe("right");
  });
});

describe("transformText", () => {
  it("applies text-transform to Latin and leaves Indic text alone", () => {
    expect(transformText("Personal details", "uppercase", "en")).toBe("PERSONAL DETAILS");
    expect(transformText("ವೈಯಕ್ತಿಕ ವಿವರಗಳು", "uppercase", "kn")).toBe("ವೈಯಕ್ತಿಕ ವಿವರಗಳು");
    expect(transformText("sai teja", "capitalize", "en")).toBe("Sai Teja");
    expect(transformText("Sai", "none", "en")).toBe("Sai");
  });
});

describe("normalizeSvgIds", () => {
  it("renames useId ids (colons, «») and every reference to them", () => {
    const host = document.createElement("div");
    host.innerHTML = `<svg viewBox="0 0 10 10"><defs><linearGradient id=":r1:"></linearGradient><linearGradient id="«r2»" href="#:r1:"></linearGradient></defs><path fill="url(#:r1:)" stroke='url("#«r2»")'/></svg>`;
    const svg = host.firstElementChild!;
    normalizeSvgIds(svg);
    expect(svg.querySelectorAll("linearGradient")[0].id).toBe("i0");
    expect(svg.querySelectorAll("linearGradient")[1].getAttribute("href")).toBe("#i0");
    expect(svg.querySelector("path")!.getAttribute("fill")).toBe("url(#i0)");
    expect(svg.querySelector("path")!.getAttribute("stroke")).toBe('url("#i1")');
  });

  it("gives two copies of the same artwork identical markup", () => {
    const make = (id: string) => {
      const host = document.createElement("div");
      host.innerHTML = `<svg><linearGradient id="${id}"/><path fill="url(#${id})"/></svg>`;
      normalizeSvgIds(host.firstElementChild!);
      return host.innerHTML;
    };
    expect(make(":r5:")).toBe(make(":r9:"));
  });
});
