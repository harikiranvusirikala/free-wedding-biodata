import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareFiles, copyPagesNow, saveBlob, shareFiles, uniquifyIds } from "./export-files";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function svgPage() {
  const pages = document.createElement("div");
  pages.className = "doc-pages";
  pages.innerHTML = `
    <article class="doc-page" data-page="1" lang="en">
      <svg viewBox="0 0 10 10"><defs><linearGradient id="g1"></linearGradient><path id="leaf" d="M0 0"/></defs>
        <rect fill="url(#g1)" style="stroke: url('#g1')"/><use href="#leaf"/><use xlink:href="#other"/></svg>
      <p>Sai Teja Mandapati</p>
    </article>`;
  return pages;
}

describe("uniquifyIds", () => {
  it("renames ids and every reference to them, leaving unknown references alone", () => {
    const pages = svgPage();
    uniquifyIds(pages, "c1");
    expect(pages.querySelector("linearGradient")!.id).toBe("g1-c1");
    expect(pages.querySelector("path")!.id).toBe("leaf-c1");
    const rect = pages.querySelector("rect")!;
    expect(rect.getAttribute("fill")).toBe("url(#g1-c1)");
    expect(rect.getAttribute("style")).toBe("stroke: url('#g1-c1')");
    const uses = pages.querySelectorAll("use");
    expect(uses[0].getAttribute("href")).toBe("#leaf-c1");
    expect(uses[1].getAttribute("xlink:href")).toBe("#other");
  });
});

describe("copyPagesNow", () => {
  it("puts a self-contained, off-screen, hidden-from-readers copy in the page and removes it again", () => {
    const pages = svgPage();
    document.body.append(pages);
    const copy = copyPagesNow(pages);
    expect(copy.root.parentElement).toBe(document.body);
    expect(copy.root.getAttribute("aria-hidden")).toBe("true");
    expect(copy.root.style.position).toBe("fixed");
    expect(copy.root.querySelectorAll("[data-page][lang]")).toHaveLength(1);
    expect(copy.root.textContent).toContain("Sai Teja Mandapati");
    // The original keeps its ids; the copy's are its own.
    expect(pages.querySelector("#g1")).not.toBeNull();
    expect(copy.root.querySelector("#g1")).toBeNull();
    expect(copy.root.classList.contains("print-pages")).toBe(false);
    copy.dispose();
    expect(document.querySelectorAll(".doc-copy")).toHaveLength(0);
  });

  it("marks a copy for printing", () => {
    const pages = svgPage();
    const copy = copyPagesNow(pages, { print: true });
    expect(copy.root.classList.contains("print-pages")).toBe(true);
    copy.dispose();
  });
});

describe("saveBlob", () => {
  it("downloads through a temporary link with the given name", () => {
    const created = vi.fn(() => "blob:test");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicks: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });
    saveBlob(new Blob(["%PDF"], { type: "application/pdf" }), "Sai Teja Mandapati Biodata.pdf");
    expect(clicks).toEqual([{ href: "blob:test", download: "Sai Teja Mandapati Biodata.pdf" }]);
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });
});

describe("sharing files", () => {
  it("is off when the browser has no file sharing", () => {
    vi.stubGlobal("navigator", { ...navigator, share: undefined, canShare: undefined });
    expect(canShareFiles(["application/pdf"])).toBe(false);
  });

  it("asks the browser whether it takes these files", () => {
    const canShare = vi.fn((data: ShareData) => data.files!.every((f) => f.type === "application/pdf"));
    vi.stubGlobal("navigator", { ...navigator, share: vi.fn(), canShare });
    expect(canShareFiles(["application/pdf"])).toBe(true);
    expect(canShareFiles(["image/png"])).toBe(false);
  });

  it("treats closing the share sheet as cancelled and a refused share as needing another tap", async () => {
    const file = new File(["%PDF"], "Sai Teja Mandapati Biodata.pdf", { type: "application/pdf" });
    const share = vi.fn().mockRejectedValueOnce(new DOMException("closed", "AbortError")).mockRejectedValueOnce(new DOMException("no", "NotAllowedError")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { ...navigator, share, canShare: () => true });
    expect(await shareFiles([file])).toBe("cancelled");
    expect(await shareFiles([file])).toBe("needs-tap");
    expect(await shareFiles([file], "Marriage Biodata")).toBe("shared");
    expect(share).toHaveBeenLastCalledWith({ files: [file], title: "Marriage Biodata" });
  });

  it("passes other failures on", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: vi.fn().mockRejectedValue(new TypeError("bad")), canShare: () => true });
    await expect(shareFiles([new File(["x"], "a.pdf")])).rejects.toThrow("bad");
  });
});
