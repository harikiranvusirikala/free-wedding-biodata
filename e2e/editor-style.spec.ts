import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getDocDictionary } from "../src/i18n/doc";
import { SAVED, openStoredDraft, readStored, sampleDraft, storedField } from "./editor-helpers";
import { meanPixelDifference, openOwnerStyleDraft, ownerStyleDraft } from "./style-helpers";

// Step 4.5 (owner's M1 polish, refined after M1): the Telugu families' label wording in the preview's "Text and labels"
// controls; dates always dd-mm-yyyy (the Dates choice and the one-tap Style line were withdrawn); the Save as image
// note; relaxed spacing on a one-page biodata; and the A7 screenshots of all of it. Desktop opens the "Text size"
// panel, the phone sheet opens the "Label wording" dialog; both hold the same wording control.

const fresh = (page: Page) => page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]');
const preview = (page: Page) => page.getByTestId("preview-pages");

/** Opens the controls that hold the label wording, and returns the part that holds them. */
async function openStyle(page: Page, isMobile: boolean): Promise<Locator> {
  if (isMobile) {
    const dialog = page.getByRole("dialog", { name: "Label wording", exact: true });
    if (!(await dialog.isVisible())) {
      const sheet = page.getByRole("dialog", { name: "Preview" });
      if (!(await sheet.isVisible())) {
        await page.getByTestId("preview-pill").click();
        await expect(sheet).toBeVisible();
      }
      await sheet.getByRole("button", { name: /^Label wording/ }).click();
    }
    await expect(dialog).toBeVisible();
    return dialog;
  }
  const panel = page.getByTestId("text-size-panel");
  if (!(await panel.isVisible())) await page.getByRole("button", { name: /^Text size: / }).click();
  await expect(panel).toBeVisible();
  return panel;
}

/** A form input by its label: a combobox (Nakshatra, Rashi) or a text box, whichever the field is. */
const formInput = (scope: Locator, label: string) => scope.getByRole("combobox", { name: label, exact: true }).or(scope.getByRole("textbox", { name: label, exact: true }));

const wordingRadio = (controls: Locator, name: "Standard" | "Telugu families") => controls.getByRole("radiogroup", { name: "Label wording" }).getByRole("radio", { name });

/** The four words Telugu families' wording changes, and the standard words it leaves alone. */
const TELUGU_WORDS = ["Star", "Raasi", "Swagothram", "Maternal Gothram"];
const STANDARD_WORDS = ["Nakshatra", "Rashi", "Gotra", "Maternal Gotra"];
const UNCHANGED = ["Date of Birth", "Time of Birth", "Place of Birth", "Qualification", "Occupation", "Annual Income", "Contact Details"];
/** Words of the earlier, longer Telugu wording (withdrawn): they must never print now. */
const WITHDRAWN = ["Birth Star", "Date Of Birth", "Time Of Birth", "Place Of Birth", "Education", "Profession", "Salary", "Contact Information"];

async function ready(page: Page, id: string, draft = ownerStyleDraft(id)) {
  await openStoredDraft(page, draft);
  await expect(fresh(page)).toHaveAttribute("data-doc-pages", "1");
}

const stored = (page: Page, id: string) => readStored(page, id);

test.describe("dates", () => {
  test("print dd-mm-yyyy, and the controls offer no date style or Style line", async ({ page, isMobile }) => {
    const id = "style-dates";
    await ready(page, id);
    await expect(preview(page)).toContainText("13-01-1998");
    const controls = await openStyle(page, isMobile);
    await expect(controls.getByRole("radiogroup", { name: "Label wording" })).toBeVisible();
    await expect(controls.getByRole("radiogroup", { name: "Dates" })).toHaveCount(0);
    await expect(controls.getByTestId("date-formats")).toHaveCount(0);
    await expect(controls.getByTestId("style-preset")).toHaveCount(0);
    await expect(controls.getByText(/Month in words|Month with dashes|13 January 1998|13-January-1998/)).toHaveCount(0);
    await expect(controls.getByText("Style:", { exact: true })).toHaveCount(0);
    if (!isMobile) {
      // Desktop: one panel, "Text and labels": text size, labels, then the wording.
      await expect(page.getByRole("dialog", { name: "Text and labels", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Text size: .*\. Change the text size or labels$/ })).toBeVisible();
      await expect(controls.getByRole("radiogroup", { name: "Text size" })).toBeVisible();
      await expect(controls.getByRole("radiogroup", { name: "Labels", exact: true })).toBeVisible();
    }
  });

  test("a draft saved with another date style still prints 13-01-1998, in any language, and keeps what it stored", async ({ page, isMobile }) => {
    const id = "style-old-dates";
    await ready(page, id, ownerStyleDraft(id, (p) => {
      p.options.dateFormat = "d month yyyy";
    }));
    await expect(preview(page)).toContainText("13-01-1998");
    await expect(preview(page)).not.toContainText("January");
    // The form shows the date the way it prints, with no "prints as" words beside it.
    if (!isMobile) {
      const dob = page.locator('[data-section="personal"]').getByRole("textbox", { name: "Date of Birth", exact: true });
      await expect(dob).toHaveValue("13-01-1998");
      await expect(page.locator('[data-section="personal"]')).not.toContainText("January");
    }
    // Opened and shown, never rewritten: the stored value is kept for compatibility (and ignored).
    expect((await stored(page, id)).options.dateFormat).toBe("d month yyyy");

    const te = "style-old-dates-te";
    await ready(page, te, ownerStyleDraft(te, (p) => {
      p.options.dateFormat = "d-month-yyyy";
      p.docLanguage = "te";
    }));
    await expect(preview(page)).toContainText("13-01-1998");
    await expect(preview(page)).not.toContainText(`13-${getDocDictionary("te").months[0]}-1998`);
  });
});

test.describe("label wording", () => {
  test("Telugu families' wording changes four labels, printed and in the form, and survives a reload", async ({ page, isMobile }) => {
    const id = "style-telugu";
    await ready(page, id);
    for (const label of STANDARD_WORDS) await expect(preview(page), label).toContainText(label);
    await expect(formInput(page.locator('[data-section="personal"]'), "Nakshatra")).toBeVisible();
    const controls = await openStyle(page, isMobile);
    await expect(wordingRadio(controls, "Standard")).toBeChecked();
    await expect(controls.getByText("Star, Raasi, Swagothram, Maternal Gothram. This changes English headings only; a label you renamed keeps your words.")).toBeVisible();

    await wordingRadio(controls, "Telugu families").click();
    await expect(wordingRadio(controls, "Telugu families")).toBeChecked();
    for (const label of TELUGU_WORDS) await expect(preview(page), label).toContainText(label);
    await expect(preview(page)).not.toContainText("Nakshatra");
    await expect(preview(page)).not.toContainText("Rashi");
    // Every other label is the standard one, including the ones the earlier wording changed.
    for (const label of UNCHANGED) await expect(preview(page), label).toContainText(label);
    for (const label of WITHDRAWN) await expect(preview(page), label).not.toContainText(label);
    // Wording only: what the family typed is as it was, and so are the dates.
    await expect(preview(page)).toContainText("Sai Teja Mandapati");
    await expect(preview(page)).toContainText("Personal Details");
    await expect(preview(page)).toContainText("13-01-1998");
    await expect.poll(async () => (await stored(page, id)).options.labelStyle).toBe("telugu");

    // What you see in the form is what prints.
    if (!isMobile) {
      const personal = page.locator('[data-section="personal"]');
      for (const label of TELUGU_WORDS) await expect(formInput(personal, label), `form: ${label}`).toBeVisible();
      for (const label of ["Date of Birth", "Qualification", "Occupation", "Annual Income"]) await expect(formInput(personal, label), `form: ${label}`).toBeVisible();
      await expect(page.locator('[data-section="contact"]').getByRole("heading", { name: "Contact Details" })).toBeVisible();
    }

    await expect(page.getByTestId("save-status")).toHaveText(SAVED);
    await page.reload();
    await expect(fresh(page)).toHaveAttribute("data-doc-pages", "1");
    await expect(preview(page)).toContainText("Swagothram");
    await expect(preview(page)).toContainText("Contact Details");
    const again = await openStyle(page, isMobile);
    await expect(wordingRadio(again, "Telugu families")).toBeChecked();

    // And back.
    await wordingRadio(again, "Standard").click();
    await expect(preview(page)).toContainText("Nakshatra");
    await expect(preview(page)).not.toContainText("Swagothram");
    await expect.poll(async () => (await stored(page, id)).options.labelStyle).toBe("standard");
  });

  test("a label the user renamed always wins", async ({ page, isMobile }) => {
    const id = "style-renamed";
    await ready(page, id, ownerStyleDraft(id, (p) => {
      storedField(p, "gotra")!.label = "Kula Gotram";
      p.options.labelStyle = "telugu";
    }));
    await expect(preview(page)).toContainText("Kula Gotram");
    await expect(preview(page)).not.toContainText("Swagothram");
    await expect(preview(page)).toContainText("Maternal Gothram");
    if (!isMobile) await expect(formInput(page.locator('[data-section="personal"]'), "Kula Gotram")).toBeVisible();
  });

  test("another printing language ignores the style, and the control says so", async ({ page, isMobile }) => {
    const id = "style-hindi";
    await ready(page, id, ownerStyleDraft(id, (p) => {
      p.docLanguage = "hi";
      p.options.labelStyle = "telugu";
    }));
    const hi = getDocDictionary("hi").fields;
    await expect(preview(page)).toContainText(hi.nakshatra);
    await expect(preview(page)).not.toContainText("Swagothram");
    await expect(preview(page)).not.toContainText("Raasi");
    const controls = await openStyle(page, isMobile);
    await expect(wordingRadio(controls, "Telugu families")).toBeDisabled();
    await expect(controls.getByText(/applies to English headings only/)).toBeVisible();
    // The stored choice is kept for when the page is English again.
    expect((await stored(page, id)).options.labelStyle).toBe("telugu");
  });

  test("a new draft starts Standard", async ({ page }) => {
    await page.goto("/editor?new=1");
    await expect(page.getByTestId("editor-form")).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
    await expect(page.getByTestId("save-status")).toHaveText(SAVED);
    const id = new URL(page.url()).searchParams.get("d")!;
    const profile = await stored(page, id);
    expect(profile.options.labelStyle ?? "standard").toBe("standard");
    expect(profile.options.dateFormat).toBe("dd-mm-yyyy");
  });
});

test("Save as image says the PDF is the sharpest copy, and PNG is the lossless one", async ({ page, isMobile }) => {
  await ready(page, "style-image-note");
  if (isMobile) {
    await page.getByTestId("preview-pill").click();
    await page.getByRole("dialog", { name: "Preview" }).getByRole("button", { name: "Save as image" }).click();
  } else {
    await page.getByRole("button", { name: "Save as image" }).click();
  }
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByTestId("image-note")).toHaveText("The PDF is the sharpest copy. Images suit WhatsApp status and screens.");
  await expect(menu.getByRole("menuitem", { name: /Save as PNG/ })).toContainText("Lossless, sharpest picture");
  await expect(menu.getByRole("menuitem", { name: /Save as JPEG/ })).toContainText("good for WhatsApp");
});

/** The first value of the first quantisation table of a JPEG: it falls as the quality rises. */
function firstQuantisationValue(jpeg: Uint8Array): number {
  for (let i = 2; i + 5 < jpeg.length; ) {
    if (jpeg[i] !== 0xff) break;
    if (jpeg[i + 1] === 0xdb) return jpeg[i + 5];
    i += 2 + ((jpeg[i + 2] << 8) | jpeg[i + 3]);
  }
  throw new Error("no quantisation table in the JPEG");
}

test("Save as JPEG uses the default quality chosen in Step 4.5 (0.97), sharper than the old 0.92", async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await ready(page, "style-jpeg-quality");
  if (isMobile) {
    await page.getByTestId("preview-pill").click();
    await page.getByRole("dialog", { name: "Preview" }).getByRole("button", { name: "Save as image" }).click();
  } else {
    await page.getByRole("button", { name: "Save as image" }).click();
  }
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Save as JPEG/ }).click()]);
  const saved = new Uint8Array(await readFile((await download.path())!));
  expect(download.suggestedFilename()).toBe("Sai Teja Mandapati Biodata.jpg");
  // What Chrome's encoder writes at the old and the new quality, from the same kind of canvas.
  const reference = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    canvas.getContext("2d")!.fillRect(0, 0, 32, 32);
    const first = async (quality: number) => {
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      for (let i = 2; i + 5 < bytes.length; ) {
        if (bytes[i + 1] === 0xdb) return bytes[i + 5];
        i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
      }
      return -1;
    };
    return { old: await first(0.92), sharper: await first(0.97) };
  });
  expect(reference.sharper, "a finer table at 0.97 than at 0.92").toBeLessThan(reference.old);
  expect(firstQuantisationValue(saved)).toBe(reference.sharper);
});

// Relaxed spacing (Step 4.5): a one-page biodata with room to spare gets its vertical gaps stretched (up to 1.5×);
// font sizes, frames and the photo don't change, and a biodata of two pages is left alone.
test.describe("relaxed spacing", () => {
  test.skip(({ isMobile }) => isMobile, "the layout doesn't depend on the screen; one project is enough");

  interface Layout {
    pages: number;
    step: string;
    relax: number;
    /** px from the top of the content box to the bottom of the last block, and the box's height. */
    used: number;
    capacity: number;
    /** The photo's size, to see it didn't change. */
    photo: { width: number; height: number } | null;
    /** Where the first heading's bottom edge is, to see gaps moved. */
    rows: number;
  }

  async function layoutOf(page: Page, id: string, relax: "0" | "1"): Promise<Layout> {
    await page.goto(`/dev/draft?d=${id}&relax=${relax}`);
    await expect(page.locator("body[data-doc-ready='1']")).toBeAttached({ timeout: 60_000 });
    return page.locator("[data-doc-pages]").first().evaluate((root) => {
      const first = root.querySelector<HTMLElement>("[data-page='1']")!;
      const content = first.querySelector<HTMLElement>("[data-content]")!.getBoundingClientRect();
      const blocks = [...first.querySelectorAll<HTMLElement>("[data-content] > [data-block]")];
      const last = blocks.at(-1)!.getBoundingClientRect();
      const photo = first.querySelector<HTMLElement>("img")?.getBoundingClientRect();
      return {
        pages: Number(root.getAttribute("data-doc-pages")),
        step: root.getAttribute("data-doc-step")!,
        relax: Number(root.getAttribute("data-doc-relax")),
        used: last.bottom - content.top,
        capacity: content.height,
        photo: photo ? { width: Math.round(photo.width * 10) / 10, height: Math.round(photo.height * 10) / 10 } : null,
        rows: blocks.length,
      };
    });
  }

  const DESIGNS = [
    ["classic-gold", "gold"],
    ["kalyanam", "maroon"],
    ["executive-navy", "navy"],
    ["modern-two-column", "teal"],
    ["minimal-ivory", "ivory"],
  ] as const;

  test("a one-page Simple draft is stretched in five designs; text size, photo and page count don't change", async ({ page }) => {
    test.setTimeout(240_000);
    for (const [templateId, colorId] of DESIGNS) {
      const id = `relax-${templateId}`;
      await openOwnerStyleDraft(page, ownerStyleDraft(id, (p) => {
        p.templateId = templateId;
        p.colorId = colorId;
        const family = p.sections.find((s) => s.kind === "family");
        if (family?.kind === "family") family.members = family.members.slice(0, 4);
      }));
      const before = await layoutOf(page, id, "0");
      const after = await layoutOf(page, id, "1");
      const name = `${templateId}: ${JSON.stringify({ before, after })}`;
      expect(before.relax, name).toBe(1);
      expect(after.pages, name).toBe(before.pages);
      expect(after.pages, name).toBe(1);
      expect(after.step, name).toBe(before.step);
      expect(after.photo, name).toEqual(before.photo);
      expect(after.rows, name).toBe(before.rows);
      expect(after.relax, name).toBeGreaterThan(1);
      expect(after.relax, name).toBeLessThanOrEqual(1.5);
      expect(after.used, name).toBeGreaterThan(before.used + 10);
      // Composed, never overfull: the page is filled up to 98.5 % of its content box and no further.
      expect(after.used, name).toBeLessThanOrEqual(after.capacity * 0.985 + 1);
    }
  });

  test("a two-page biodata is untouched, and so is one that is nearly full", async ({ page }) => {
    const long = "two-pages";
    await openStoredDraft(page, sampleDraft(long));
    const [before, after] = [await layoutOf(page, long, "0"), await layoutOf(page, long, "1")];
    expect(before.pages).toBe(2);
    expect(after).toEqual(before);
    expect(after.relax).toBe(1);

    // The full owner-style page at the largest size has under 3 % left: it stays as it is, or barely moves.
    const full = "nearly-full";
    await openOwnerStyleDraft(page, ownerStyleDraft(full, (p) => {
      p.options.textSize = "xl";
    }));
    const tight = await layoutOf(page, full, "1");
    const tightBefore = await layoutOf(page, full, "0");
    expect(tight.pages).toBe(1);
    expect(tight.step).toBe(tightBefore.step);
    expect(tight.used).toBeLessThanOrEqual(tight.capacity + 0.5);
    expect(tight.relax).toBeGreaterThanOrEqual(1);
  });

  test("every document language, short and long, stays inside its page and keeps its page count", async ({ page }) => {
    test.setTimeout(240_000);
    for (const lang of ["en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"] as const) {
      const id = `relax-${lang}`;
      await openStoredDraft(page, ownerStyleDraft(id, (p) => {
        p.docLanguage = lang;
      }));
      const before = await layoutOf(page, id, "0");
      const after = await layoutOf(page, id, "1");
      const name = `${lang}: ${JSON.stringify({ before, after })}`;
      expect(after.pages, name).toBe(before.pages);
      expect(after.step, name).toBe(before.step);
      expect(after.used, name).toBeLessThanOrEqual(after.capacity + 0.5);
      expect(after.relax, name).toBeLessThanOrEqual(1.5);
      if (after.pages > 1) expect(after.relax, name).toBe(1);
    }
  });

  test("the fixtures on /dev/document: single pages are stretched at most 1.5× and stay in the page, longer ones stay as they were", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto("/dev/document");
    await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
    const found = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-variant]")].map((section) => {
        const root = section.querySelector<HTMLElement>("[data-doc-pages]")!;
        const content = section.querySelector<HTMLElement>("[data-page='1'] [data-content]")!.getBoundingClientRect();
        const last = [...section.querySelectorAll<HTMLElement>("[data-page='1'] [data-content] > [data-block]")].at(-1)!.getBoundingClientRect();
        return { id: section.dataset.variant!, pages: Number(root.dataset.docPages), relax: Number(root.dataset.docRelax), used: last.bottom - content.top, capacity: content.height };
      }),
    );
    expect(found.length).toBeGreaterThanOrEqual(76);
    const relaxed = found.filter((v) => v.relax > 1);
    for (const v of found) {
      const name = JSON.stringify(v);
      expect(v.relax, name).toBeGreaterThanOrEqual(1);
      expect(v.relax, name).toBeLessThanOrEqual(1.5);
      expect(v.used, name).toBeLessThanOrEqual(v.capacity + 0.5);
      if (v.pages > 1) expect(v.relax, name).toBe(1);
      if (v.relax > 1) expect(v.used, name).toBeLessThanOrEqual(v.capacity * 0.985 + 1);
    }
    // The short fixtures are one page with room to spare in most designs, so the feature is really in use here.
    expect(relaxed.length, `relaxed ${relaxed.map((v) => v.id).join(", ")}`).toBeGreaterThan(10);
    expect(relaxed.some((v) => v.id.endsWith("-short"))).toBe(true);
    expect(found.filter((v) => v.pages > 1 && v.relax !== 1)).toEqual([]);
  });

  test("the PNG saved from the editor matches the Download engine on the same relaxed page", async ({ page }) => {
    test.setTimeout(120_000);
    const id = "relax-download";
    await openOwnerStyleDraft(page, ownerStyleDraft(id, (p) => {
      const family = p.sections.find((s) => s.kind === "family");
      if (family?.kind === "family") family.members = family.members.slice(0, 3);
    }));
    await expect(fresh(page)).toHaveAttribute("data-doc-pages", "1");
    expect(Number(await fresh(page).getAttribute("data-doc-relax"))).toBeGreaterThan(1);

    await page.getByRole("button", { name: "Save as image" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /Save as PNG/ }).click()]);
    const editorImage = (await readFile((await download.path())!)).toString("base64");

    await page.goto(`/dev/draft?d=${id}`);
    await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
    expect(Number(await page.locator("[data-doc-relax]").first().getAttribute("data-doc-relax"))).toBeGreaterThan(1);
    const reference = await page.evaluate(() => window.__draft!.images("png"));
    expect(reference.images).toHaveLength(1);
    const diff = await meanPixelDifference(page, editorImage, reference.images[0]);
    expect(diff.widths).toEqual([2480, 2480]);
    expect(diff.mean, "mean pixel difference").toBeLessThan(0.5);
  });
});

// The A7 quality gate for this step (BUILD_PLAN A7): the preview's "Text and labels" panel at desktop, 1180 px and as
// the phone/tablet sheet with its "Label wording" dialog, Day and Night, a Telugu-style page, the end of the form
// with More photos last, and a relaxed page; saved in test-results/screenshots/ to be looked at.
test("style controls and pages at every size, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(240_000);
  const THEMES = ["light", "dark"] as const;
  const shoot = async (name: string, target?: Locator) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      const path = `test-results/screenshots/${name}-${theme === "light" ? "day" : "night"}.png`;
      if (target) await target.screenshot({ path, animations: "disabled" });
      else await page.screenshot({ path, animations: "disabled" });
    }
    await page.emulateMedia({ colorScheme: "light" });
  };

  const id = "style-screens";
  await page.setViewportSize({ width: 1440, height: 900 });
  await openOwnerStyleDraft(page, ownerStyleDraft(id, (p) => {
    const family = p.sections.find((s) => s.kind === "family");
    if (family?.kind === "family") family.members = family.members.slice(0, 4);
  }));
  await expect(fresh(page)).toHaveAttribute("data-doc-pages", "1");
  await page.getByRole("button", { name: /^Text size: / }).click();
  await expect(page.getByTestId("text-size-panel")).toBeVisible();
  await shoot("style-panel-desktop");

  // Telugu families' wording: the panel, the page and the form.
  await wordingRadio(page.getByTestId("text-size-panel"), "Telugu families").click();
  await expect(preview(page)).toContainText("Swagothram");
  await shoot("style-panel-telugu-desktop");
  await page.keyboard.press("Escape");
  await expect(fresh(page)).toHaveAttribute("data-doc-pages", "1");
  await shoot("style-telugu-page-desktop");
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.getByRole("button", { name: /^Text size: / }).click();
  await expect(page.getByTestId("text-size-panel")).toBeVisible();
  await shoot("style-panel-1180");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 810, height: 1080 });
  await page.getByTestId("preview-pill").click();
  const sheet = page.getByRole("dialog", { name: "Preview" });
  await expect(sheet).toBeVisible();
  await shoot("style-sheet-tablet");
  await sheet.getByRole("button", { name: /^Label wording/ }).click();
  const more = page.getByRole("dialog", { name: "Label wording", exact: true });
  await expect(more).toBeVisible();
  await shoot("style-dialog-tablet");
  await more.getByRole("button", { name: "Done" }).click();
  await expect(more).toBeHidden();
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sheet).toBeHidden();
  await page.getByTestId("preview-pill").click();
  await expect(sheet).toBeVisible();
  await shoot("style-sheet-phone");
  // The opener names the control and shows the choice; the row above stays "Labels" (Normal / ALL CAPS).
  await expect(sheet.getByRole("button", { name: /^Label wording/ })).toContainText("Telugu families");
  await expect(sheet.getByRole("radiogroup", { name: "Labels", exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: /^Label wording/ }).click();
  await expect(more).toBeVisible();
  await shoot("style-dialog-phone");
  await more.getByRole("button", { name: "Done" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // The end of the form: the last section, Add a section, then More photos (last, as its pages print last), with the
  // rail (desktop) or the chips (phone, tablet) showing it as the last entry.
  for (const [name, width, height] of [["phone", 390, 844], ["tablet", 810, 1080], ["desktop", 1440, 900]] as const) {
    await page.setViewportSize({ width, height });
    // The card's top under the header and chips, with Add a section just above it.
    await page.locator('[data-section="photoPages"]').evaluate((el) => {
      el.scrollIntoView({ block: "start" });
      window.scrollBy(0, -90);
    });
    await expect(page.locator('[data-section="photoPages"]')).toBeInViewport();
    await page.waitForTimeout(400);
    await shoot(`form-end-${name}`);
  }
  // The image menu, with its note.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Save as image" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await shoot("style-image-menu-desktop");
  await page.keyboard.press("Escape");

  // A relaxed page next to the same page unstretched, as the Download engine draws them.
  await page.goto(`/dev/draft?d=${id}&relax=0`);
  await expect(page.locator("body[data-doc-ready='1']")).toBeAttached({ timeout: 60_000 });
  await page.locator("[data-page='1']").screenshot({ path: "test-results/screenshots/style-relax-before.png" });
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready='1']")).toBeAttached({ timeout: 60_000 });
  await page.locator("[data-page='1']").screenshot({ path: "test-results/screenshots/style-relax-after.png" });
});
