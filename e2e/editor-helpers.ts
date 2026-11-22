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
