import { expect, type Page } from "@playwright/test";
import { SAMPLE_PROFILE } from "../src/biodata/defaults";
import type { BiodataProfile } from "../src/biodata/types";

// Shared by the editor's e2e specs: reading a draft straight from IndexedDB, and putting one there (the fictional
// sample, or a variation of it) without going through the form.

export const SAVED = /Saved on this device · \d/;

/** The draft as the browser has it on disk. */
export function readStored(page: Page, id: string): Promise<BiodataProfile> {
  return page.evaluate(
    (draftId) =>
      new Promise<BiodataProfile>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("profiles").objectStore("profiles").get(draftId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(get.result as BiodataProfile);
          };
        };
      }),
    id,
  );
}

/** A copy of the fictional sample (VISION D29: never real data) with its own id, ready to store. */
export function sampleDraft(id: string, change?: (profile: BiodataProfile) => void): BiodataProfile {
  const profile = structuredClone(SAMPLE_PROFILE) as BiodataProfile;
  profile.id = id;
  profile.draftName = "";
  profile.revision = 1;
  change?.(profile);
  return profile;
}

/**
 * Stores a draft in this browser and opens it (which also makes it the last one opened, so a plain /editor
 * reopens it). The editor is opened once first so its database exists.
 */
export async function openStoredDraft(page: Page, profile: BiodataProfile) {
  await page.goto("/editor");
  await expect(page.getByTestId("editor-form")).toBeVisible();
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("profiles", "readwrite");
          tx.objectStore("profiles").put(record);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    profile,
  );
  await page.goto(`/editor?d=${profile.id}`);
  await expect(page.getByTestId("editor-form")).toBeVisible();
}

/**
 * Switches the open draft to the Detailed form (D50: new drafts start Simple), for specs about sections only the
 * Detailed form starts with. The switch's toast is dismissed so it covers nothing the spec looks at.
 */
export async function switchToDetailed(page: Page) {
  const detailed = page.getByRole("radiogroup", { name: "Form" }).getByRole("radio", { name: "Detailed" });
  await detailed.click();
  await expect(detailed).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-section="horoscope"]')).toBeVisible();
  await page.getByTestId("manage-toast").getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("manage-toast")).toHaveCount(0);
}

/** A field's stored record, by its key. */
export function storedField(profile: BiodataProfile, key: string) {
  return profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.key === key);
}

/** A family member's stored record, by its relation key. */
export function storedMember(profile: BiodataProfile, relationKey: string) {
  return profile.sections.flatMap((s) => (s.kind === "family" ? s.members : [])).find((m) => m.relationKey === relationKey);
}

/** A PNG drawn in the page (never a real person's photo): a warm gradient, a green circle, two coloured corners. */
export async function drawnPng(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d")!;
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#f6d7a7");
      g.addColorStop(1, "#7a4b3a");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#3d6b5c";
      c.beginPath();
      c.arc(w / 2, h / 2.6, Math.min(w, h) / 6, 0, Math.PI * 2);
      c.fill();
      const s = Math.min(w, h) / 8;
      c.fillStyle = "#c0392b";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#2463c2";
      c.fillRect(w - s, 0, s, s);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [width, height],
  );
  return Buffer.from(base64, "base64");
}

/**
 * A distinguishable drawn picture (never a real person): a hue-shifted gradient with a number on it, so photos
 * can be told apart in the preview, and optionally fine random "grain" so its JPEG is as heavy as a real photo's
 * (a smooth drawing compresses to almost nothing, which would hide what a photo-heavy PDF really weighs).
 */
export async function drawnPhoto(page: Page, width: number, height: number, hue: number, label: string, { grain = false, jpeg = false }: { grain?: boolean; jpeg?: boolean } = {}): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h, hu, text, noisy, asJpeg]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d")!;
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${hu} 70% 82%)`);
      g.addColorStop(1, `hsl(${(hu + 40) % 360} 55% 32%)`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = `hsl(${(hu + 180) % 360} 45% 40%)`;
      c.beginPath();
      c.arc(w / 2, h / 2.6, Math.min(w, h) / 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.font = `bold ${Math.round(Math.min(w, h) / 5)}px sans-serif`;
      c.textAlign = "center";
      c.fillText(text, w / 2, h * 0.78);
      c.strokeStyle = "#fff";
      c.lineWidth = Math.max(4, Math.min(w, h) / 90);
      c.strokeRect(c.lineWidth * 3, c.lineWidth * 3, w - c.lineWidth * 6, h - c.lineWidth * 6);
      if (noisy) {
        // Grain over the whole picture, in 4 × 4 blocks so it survives the 3000 px → cell downscale like real sensor noise.
        const image = c.getImageData(0, 0, w, h);
        const d = image.data;
        let seed = 12345;
        const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 60;
        for (let y = 0; y < h; y += 2) {
          for (let x = 0; x < w; x += 2) {
            const n = rand();
            for (let dy = 0; dy < 2 && y + dy < h; dy++) {
              for (let dx = 0; dx < 2 && x + dx < w; dx++) {
                const i = ((y + dy) * w + x + dx) * 4;
                d[i] += n;
                d[i + 1] += n;
                d[i + 2] += n;
              }
            }
          }
        }
        c.putImageData(image, 0, 0);
      }
      return (asJpeg ? canvas.toDataURL("image/jpeg", 0.9) : canvas.toDataURL("image/png")).split(",")[1];
    },
    [width, height, hue, label, grain, jpeg] as const,
  );
  return Buffer.from(base64, "base64");
}
