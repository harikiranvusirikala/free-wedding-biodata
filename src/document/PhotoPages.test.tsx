import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocModel } from "@/biodata/document";
import type { PhotoPagesInput } from "./blocks/types";
import { PhotoPageSet } from "./PhotoPages";
import { chartPlacement, contentSize, photoPageCells } from "./photo-pages";
import { TEMPLATES, getTemplate } from "./templates";

// Step 4.2b: every design draws the pages after the biodata in its own frame, paper and margins, with its photo corner,
// numbered on from the biodata's pages, and without the biodata's top element.

const picture = (n: number, width = 800, height = 1200) => ({ src: `blob:photo/${n}`, width, height });
const doc = (templateId: string, lang: DocModel["lang"] = "en"): DocModel => ({ lang, templateId, colorId: "", textSize: "auto", labelCase: "normal", motif: "ganesha", invocation: "Sri", title: "Biodata", sections: [] });
const input = (perPage: 1 | 2 | 4, count: number, chart = false): PhotoPagesInput => ({
  perPage,
  photos: Array.from({ length: count }, (_, i) => ({ id: `p${i}`, picture: picture(i) })),
  chart: chart ? { title: "Horoscope Details", picture: picture(99, 1600, 1200) } : undefined,
});
const html = (templateId: string, i: PhotoPagesInput, first = 2, lang: DocModel["lang"] = "en") => renderToStaticMarkup(<PhotoPageSet input={i} doc={doc(templateId, lang)} firstNumber={first} bodyPx={13.5} />);
/** How React writes a length in a style attribute: 0 has no unit. */
const px = (n: number) => (n === 0 ? "0" : `${n}px`);
const attrs = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1]);

describe("PhotoPageSet", () => {
  it.each(TEMPLATES.map((t) => [t.id]))("%s: A4 pages numbered on from the biodata, one photo page per group, then the chart", (id) => {
    const markup = html(id, input(2, 3, true), 3);
    expect(attrs(markup, "data-page")).toEqual(["3", "4", "5"]);
    expect(attrs(markup, "data-extra-page")).toEqual(["photos", "photos", "chart"]);
    expect(markup.match(/<img /g)).toHaveLength(4);
    // No top element (motif, invocation, title) on the pages after the first.
    expect(markup).not.toContain("Sri");
    expect(markup).not.toContain(">Biodata<");
    // The chart page carries its heading, in the design's heading bar.
    expect(markup).toContain("Horoscope Details");
  });

  it.each(TEMPLATES.map((t) => [t.id]))("%s: photos sit in the cells the layout arithmetic gives, with the design's corner", (id) => {
    const template = getTemplate(id);
    const content = contentSize(template.pageBox(1, doc(id)));
    const markup = html(id, input(4, 3));
    const cells = photoPageCells(content, 4, 3);
    const styles = attrs(markup, "style").filter((s) => s.includes("object-fit"));
    expect(styles).toHaveLength(3);
    for (const [i, style] of styles.entries()) {
      expect(style).toContain(`left:${px(cells[i].x)}`);
      expect(style).toContain(`top:${px(cells[i].y)}`);
      expect(style).toContain(`width:${px(cells[i].width)}`);
      expect(style).toContain(`height:${px(cells[i].height)}`);
      expect(style).toContain("object-fit:cover");
      expect(style).toContain(`border-radius:${template.photoRadius ?? 10}px`);
    }
  });

  it("fits the chart whole: its box is the picture's own shape, never cropped", () => {
    const template = getTemplate("classic-gold");
    const content = contentSize(template.pageBox(1, doc("classic-gold")));
    const markup = html("classic-gold", { perPage: 1, photos: [], chart: { title: "Horoscope Details", picture: picture(1, 1600, 1200) } }, 2);
    const at = chartPlacement(content, picture(1, 1600, 1200));
    const style = attrs(markup, "style").find((s) => s.includes("object-fit"))!;
    expect(style).toContain("object-fit:fill");
    expect(style).toContain(`width:${at.width}px`);
    expect(style).toContain(`height:${at.height}px`);
    expect(at.width / at.height).toBeCloseTo(4 / 3, 2);
  });

  it("draws nothing for a photo that isn't drawn yet, but keeps its page", () => {
    const markup = html("classic-gold", { perPage: 2, photos: [{ id: "a", picture: picture(1) }, { id: "b" }] });
    expect(attrs(markup, "data-page")).toEqual(["2"]);
    expect(markup.match(/<img /g)).toHaveLength(1);
  });

  it("prints the chart heading in the document's language", () => {
    const markup = html("classic-gold", { perPage: 1, photos: [], chart: { title: "జాతక వివరాలు", picture: picture(1) } }, 2, "te");
    expect(markup).toContain("జాతక వివరాలు");
    expect(markup).toContain('lang="te"');
  });

  it("adds nothing for no photos and no chart", () => {
    expect(html("classic-gold", { perPage: 1, photos: [] })).toBe("");
  });
});
