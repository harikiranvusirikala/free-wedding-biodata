import { describe, expect, it } from "vitest";
import en from "@/i18n/app/en.json";
import { PRODUCTION_URL } from "@/lib/site";
import { FAQ, FAQ_IDS, breadcrumbs, galleryStructuredData, homeStructuredData, jsonLd } from "./content";

// The landing page's structured data (VISION D26, D36): one source for the page and for search engines.

const site = PRODUCTION_URL;
type Node = Record<string, unknown> & { "@type": string };
const graph = () => (homeStructuredData(site)["@graph"] as Node[]);
const byType = (type: string) => graph().find((n) => n["@type"] === type)!;

describe("the landing page's questions", () => {
  it("are written questions and answers in the app's words", () => {
    for (const id of FAQ_IDS) {
      expect(en, id).toHaveProperty(`help.faq.${id}.q`);
      expect(en, id).toHaveProperty(`help.faq.${id}.a`);
    }
    expect(FAQ.every((q) => q.question.endsWith("?") && q.answer.length > 20)).toBe(true);
  });
});

describe("homeStructuredData", () => {
  it("describes the publisher, the site, a free web app and the questions; no HowTo, nothing counted", () => {
    expect(graph().map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebApplication", "FAQPage"]);
    const app = byType("WebApplication");
    expect(app).toMatchObject({ isAccessibleForFree: true, offers: { "@type": "Offer", price: "0" }, url: `${site}/` });
    const json = JSON.stringify(homeStructuredData(site));
    expect(json).not.toMatch(/HowTo|aggregateRating|interactionCount|userInteractionCount/);
  });

  it("gives search engines exactly the questions the page shows", () => {
    const faq = byType("FAQPage") as unknown as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(FAQ.map((q) => [q.question, q.answer]));
  });
});

describe("breadcrumbs and the gallery", () => {
  it("puts a page under Home", () => {
    expect(breadcrumbs(site, [["Help", "/help"]]).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${site}/` },
      { "@type": "ListItem", position: 2, name: "Help", item: `${site}/help` },
    ]);
  });

  it("lists each design's sample picture", () => {
    const list = galleryStructuredData(site, [{ id: "peacock", name: "Peacock" }]);
    expect(list.itemListElement[0].item).toMatchObject({ "@type": "ImageObject", contentUrl: `${site}/designs/peacock.webp`, name: "Peacock" });
  });
});

describe("jsonLd", () => {
  it("can never close the <script> it sits in", () => {
    expect(jsonLd({ a: "</script><b>" })).toBe('{"a":"\\u003c/script>\\u003cb>"}');
  });
});
