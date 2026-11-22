import { expect, type Page } from "@playwright/test";
import { createProfile } from "../src/biodata/defaults";
import type { BiodataProfile, Field } from "../src/biodata/types";
import { SAVED, drawnPng, openStoredDraft } from "./editor-helpers";

// Shared by the Step 4.5 specs: a Simple-form draft like the one the owner made for M1 (the four Simple sections, a
// photo beside Personal details, a long family list), with entirely fictional data (VISION D29; phone numbers in the
// unassigned +91 90000 range). Never copy a value from docs/references/ here.

const VALUES: Record<string, Partial<Pick<Field, "value" | "optionKey">>> = {
  fullName: { value: "Sai Teja Mandapati" },
  dateOfBirth: { value: "1998-01-13" },
  birthTime: { value: "22:55" },
  birthPlace: { value: "Hyderabad" },
  nakshatra: { value: "Pushya (3rd Pada)" },
  rashi: { value: "Karka", optionKey: "karka" },
  caste: { value: "Sample Community" },
  gotra: { value: "Bharadwaja" },
  maternalGotra: { value: "Kashyapa" },
  height: { value: "173" },
  complexion: { value: "Fair" },
  highestQualification: { value: "B.Tech (Computer Science), Sample Institute of Engineering (A)" },
  occupation: { value: "Software Engineer (L3), Example Technologies, Hyderabad" },
  annualIncome: { value: "24 LPA" },
  phone: { value: "+91 90000 00001" },
  address: { value: "5-8-8, Sample Street, Guntur, Andhra Pradesh - 500001" },
  partnerExpectations: { value: "A kind, well-educated and family-minded girl who is cheerful and supportive, and who respects tradition while staying open to new ideas." },
};

const FAMILY: { relationKey?: string; relation?: string; details: string }[] = [
  { relationKey: "father", details: "Mandapati Venkata Rao, Sri Sai Traders, +91 90000 00003" },
  { relationKey: "mother", details: "Mandapati Lakshmi (Home Maker), +91 90000 00004" },
  { relationKey: "elderBrother", details: "Mandapati Rahul (M.S., Sample University), Staff Engineer at Example Labs, California, US" },
  { relationKey: "sisterInLaw", details: "Mandapati Anitha, Senior Software Engineer at Example Cloud, California, US" },
  { relationKey: "grandfather", details: "(Late) Mandapati Narayana Murthy (Nani Garu)" },
  { relationKey: "fatherInLaw", details: "Example Srinivas, Hyderabad, +91 90000 00005" },
];

/** The owner's-style Simple draft: personal, family, contact and partner preferences filled in. */
export function ownerStyleDraft(id: string, change?: (profile: BiodataProfile) => void): BiodataProfile {
  let n = 0;
  const profile = createProfile({ newId: () => `${id}-${++n}`, now: () => new Date("2026-11-22T09:00:00.000Z"), formLayout: "simple" });
  profile.id = id;
  profile.revision = 1;
  for (const section of profile.sections) {
    if (section.kind === "fields") {
      for (const field of section.fields) {
        const values = field.key ? VALUES[field.key] : undefined;
        if (values) Object.assign(field, values);
      }
    } else if (section.key === "family") {
      section.members = FAMILY.map((m) => ({ id: `${id}-m${++n}`, relationKey: m.relationKey, relation: m.relation ?? "", details: m.details, visible: true }));
    }
  }
  change?.(profile);
  return profile;
}

/** Stores the draft, opens it, and adds a drawn photo (3:4) through the photo card, as a person would. */
export async function openOwnerStyleDraft(page: Page, profile: BiodataProfile, { photo = true } = {}) {
  await openStoredDraft(page, profile);
  if (!photo) return;
  const card = page.locator('[data-section="photo"]');
  await card.getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1500, 2000) });
  const cropper = page.getByRole("dialog", { name: "Crop your photo" });
  await expect(cropper).toBeVisible();
  await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  await cropper.getByRole("button", { name: "Done" }).click();
  await expect(cropper).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
}

/**
 * How far apart two PNGs are, as the mean absolute difference per colour channel (0–255) after both are drawn at
 * 620 px wide, and their natural widths. Runs in the page; the images are base64.
 */
export function meanPixelDifference(page: Page, a: string, b: string): Promise<{ mean: number; widths: number[] }> {
  return page.evaluate(
    async ([x, y]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [one, two] = await Promise.all([load(`data:image/png;base64,${x}`), load(`data:image/png;base64,${y}`)]);
      const w = 620;
      const h = Math.round((w * one.naturalHeight) / one.naturalWidth);
      const pixels = (img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext("2d")!;
        c.drawImage(img, 0, 0, w, h);
        return c.getImageData(0, 0, w, h).data;
      };
      const p = pixels(one);
      const q = pixels(two);
      let sum = 0;
      for (let k = 0; k < p.length; k++) sum += Math.abs(p[k] - q[k]);
      return { mean: sum / p.length, widths: [one.naturalWidth, two.naturalWidth] };
    },
    [a, b] as const,
  );
}
