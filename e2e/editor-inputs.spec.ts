import { expect, test, type Page } from "@playwright/test";
import { SAVED, openStoredDraft, readStored, sampleDraft, storedField, storedMember } from "./editor-helpers";

// Step 2.1: the editor's sections and an input for every field type (VISION §6, D13, D33, D47). Values are typed
// as people type them, stored in their formats, and come back after a reload; hidden fields keep their values;
// the section rail and the phone's section chips move through the form; everything works from the keyboard.

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const section = (page: Page, key: string) => page.locator(`[data-section="${key}"]`);
const label = (page: Page, text: string) => page.getByLabel(text, { exact: true });

async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(label(page, "Name")).toBeVisible();
  return idOf(page);
}

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): the editor requests nothing from another origin.
  page.on("request", (request) => {
    expect(["localhost", "127.0.0.1"], `request to ${request.url()}`).toContain(new URL(request.url()).hostname);
  });
});

test("one field of every type is stored in its format and restored after a reload", async ({ page }) => {
  const id = await openNewDraft(page);
  const personal = section(page, "personal");

  // text: the first letter is capitalised when the field is left (D47)
  await label(page, "Name").fill("sai teja Mandapati");
  // date: typed day first, stored ISO
  await label(page, "Date of Birth").fill("14/8/1996");
  // height: feet and inches, stored in cm (D13)
  await personal.getByLabel("Height", { exact: true }).selectOption({ label: "5 ft 10 in · 178 cm" });
  // select, picked from the list: stored as its key (D33)
  await page.getByRole("combobox", { name: "Marital Status" }).click();
  await page.getByRole("listbox", { name: "Marital Status" }).getByRole("option", { name: "Never Married" }).click();
  // select, typed: printed as typed, no key
  await page.getByRole("combobox", { name: "Mother Tongue" }).fill("telugu and English");
  // select, an option's name typed in full counts as picking it
  await page.getByRole("combobox", { name: "Religion" }).fill("hindu");
  // time: typed 12-hour, stored HH:mm
  await label(page, "Time of Birth").fill("6:45 pm");
  // phone and email: as typed, with the right keyboards
  await expect(label(page, "Phone")).toHaveAttribute("type", "tel");
  await expect(label(page, "Phone")).toHaveAttribute("inputmode", "tel");
  await label(page, "Phone").fill("+91 90000 00001");
  await expect(label(page, "Email")).toHaveAttribute("type", "email");
  await label(page, "Email").fill("saiteja.sample@example.com");
  // multiline row and paragraph
  await label(page, "Address").fill("plot 12, Sample Colony\nGuntur");
  await page.getByRole("textbox", { name: "About Me" }).fill("i enjoy music and cricket.");
  // a family member's details
  await label(page, "Father").fill("venkata Rao, Retired Headmaster");
  await label(page, "Email").focus(); // leaves About me / Father, so their first letters are capitalised
  await expect(status(page)).toHaveText(SAVED);

  const check = async () => {
    await expect(label(page, "Name")).toHaveValue("Sai teja Mandapati");
    await expect(label(page, "Date of Birth")).toHaveValue("14-08-1996");
    await expect(personal.getByLabel("Height", { exact: true })).toHaveValue("70");
    await expect(page.getByRole("combobox", { name: "Marital Status" })).toHaveValue("Never Married");
    await expect(page.getByRole("combobox", { name: "Mother Tongue" })).toHaveValue("Telugu and English");
    await expect(page.getByRole("combobox", { name: "Religion" })).toHaveValue("Hindu");
    await expect(label(page, "Time of Birth")).toHaveValue("6:45 PM");
    await expect(label(page, "Phone")).toHaveValue("+91 90000 00001");
    await expect(label(page, "Email")).toHaveValue("saiteja.sample@example.com");
    await expect(label(page, "Address")).toHaveValue("Plot 12, Sample Colony\nGuntur");
    await expect(page.getByRole("textbox", { name: "About Me" })).toHaveValue("I enjoy music and cricket.");
    await expect(label(page, "Father")).toHaveValue("Venkata Rao, Retired Headmaster");
  };
  await check();
  await page.reload();
  await check();

  const stored = await readStored(page, id);
  expect(storedField(stored, "fullName")).toMatchObject({ value: "Sai teja Mandapati" });
  expect(storedField(stored, "dateOfBirth")).toMatchObject({ value: "1996-08-14" });
  expect(storedField(stored, "height")).toMatchObject({ value: "178" });
  expect(storedField(stored, "maritalStatus")).toMatchObject({ value: "Never Married", optionKey: "neverMarried" });
  expect(storedField(stored, "motherTongue")?.value).toBe("Telugu and English");
  expect(storedField(stored, "motherTongue")).not.toHaveProperty("optionKey");
  expect(storedField(stored, "religion")).toMatchObject({ optionKey: "hindu" });
  expect(storedField(stored, "birthTime")).toMatchObject({ value: "18:45" });
  expect(storedField(stored, "phone")).toMatchObject({ value: "+91 90000 00001" });
  expect(storedField(stored, "email")).toMatchObject({ value: "saiteja.sample@example.com" });
  expect(storedField(stored, "address")).toMatchObject({ value: "Plot 12, Sample Colony\nGuntur" });
  expect(storedField(stored, "aboutMe")).toMatchObject({ value: "I enjoy music and cricket." });
  expect(storedMember(stored, "father")).toMatchObject({ details: "Venkata Rao, Retired Headmaster" });

  // Typing over a picked option clears its key: what's typed prints as typed (D33).
  await page.getByRole("combobox", { name: "Marital Status" }).fill("Never married (first marriage)");
  await expect(status(page)).toHaveText(SAVED);
  await expect.poll(async () => storedField(await readStored(page, id), "maritalStatus")).not.toHaveProperty("optionKey");
});

test("values typed before this step are kept: a free-text date is tidied, other text stays as typed", async ({ page }) => {
  const id = "legacy-draft";
  await openStoredDraft(
    page,
    sampleDraft(id, (profile) => {
      for (const s of profile.sections) {
        if (s.kind !== "fields") continue;
        for (const f of s.fields) {
          if (f.key === "dateOfBirth") f.value = "14 August 1996";
          if (f.key === "birthTime") f.value = "around sunrise";
          if (f.key === "height") f.value = "5 feet 10";
        }
      }
    }),
  );
  await expect(label(page, "Date of Birth")).toHaveValue("14-08-1996");
  await expect(label(page, "Time of Birth")).toHaveValue("around sunrise");
  await expect(section(page, "horoscope").getByText("Prints exactly as typed.")).toBeVisible();
  await expect(section(page, "personal").getByLabel("Height", { exact: true }).locator("option:checked")).toHaveText("5 feet 10 (as typed)");
  // Nothing is rewritten until the field is used; leaving the date stores it in its format.
  expect(storedField(await readStored(page, id), "dateOfBirth")?.value).toBe("14 August 1996");
  await label(page, "Date of Birth").focus();
  await label(page, "Nationality").focus();
  await expect(status(page)).toHaveText(SAVED);
  const stored = await readStored(page, id);
  expect(storedField(stored, "dateOfBirth")?.value).toBe("1996-08-14");
  expect(storedField(stored, "birthTime")?.value).toBe("around sunrise");
  expect(storedField(stored, "height")?.value).toBe("5 feet 10");
});

test("a hidden field stays hidden after a reload, with its value", async ({ page }) => {
  const id = await openNewDraft(page);
  await label(page, "Nationality").fill("Indian");
  const eye = page.getByRole("button", { name: "Show “Nationality” on the biodata" });
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await eye.click();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("row-nationality")).toHaveAttribute("data-hidden", "");
  await expect(page.getByTestId("row-nationality")).toContainText("Hidden");
  await expect(status(page)).toHaveText(SAVED);

  await page.reload();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(label(page, "Nationality")).toHaveValue("Indian");
  expect(storedField(await readStored(page, id), "nationality")).toMatchObject({ value: "Indian", visible: false });
  // Hidden rows are left out of the count: Personal has 8 rows that print, none filled.
  await expect(section(page, "personal").getByTestId("section-completion")).toHaveText("0 of 8 filled");
});

test("the section rail scrolls to a section and follows the scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail is for wide screens; phones have the chips");
  await openStoredDraft(page, sampleDraft("rail-draft"));
  const rail = page.getByTestId("section-rail");
  await expect(rail.getByRole("link", { name: /Personal Details/ })).toContainText("10/10");
  // The top of the biodata (Step 2.0) is the rail's first entry, so it is current at the top of the page.
  await expect(rail.getByRole("link", { name: "Top of your biodata" })).toHaveAttribute("aria-current", "location");

  await rail.getByRole("link", { name: /Education/ }).click();
  const heading = section(page, "education").getByRole("heading", { level: 2 });
  await expect(heading).toBeFocused();
  await expect.poll(() => heading.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(160);
  await expect(rail.getByRole("link", { name: /Education/ })).toHaveAttribute("aria-current", "location");

  // Scrolling back up moves the highlight with it.
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(rail.getByRole("link", { name: "Top of your biodata" })).toHaveAttribute("aria-current", "location");
});

test("on a phone the section chips jump to a section", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the chips replace the rail below 1024 px");
  await openStoredDraft(page, sampleDraft("chips-draft"));
  const chips = page.getByTestId("section-jump");
  await expect(chips).toBeVisible();
  await expect(page.getByTestId("section-rail")).toBeHidden();
  await chips.getByRole("link", { name: "Contact" }).click();
  const heading = section(page, "contact").getByRole("heading", { level: 2 });
  await expect.poll(() => heading.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200);
  await expect(heading).toBeInViewport();
  await expect(chips.getByRole("link", { name: "Contact" })).toHaveAttribute("aria-current", "location");
  // The chips stay under the header while the form scrolls.
  expect(await chips.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(56);
});

test("the form can be filled from the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "a hardware keyboard");
  const id = await openNewDraft(page);
  /** Presses Tab until `target` has the focus, and says how many presses that took. */
  const tabTo = async (target: ReturnType<Page["locator"]>) => {
    let presses = 0;
    while (!(await target.evaluate((el) => el === document.activeElement)) && presses < 40) {
      await page.keyboard.press("Tab");
      presses++;
    }
    await expect(target).toBeFocused();
    return presses;
  };

  // From the top of the page through the rail to the first field of Personal Details.
  await tabTo(label(page, "Name"));
  await page.keyboard.type("Asha Rani");
  // Each row is its input, then its eye button and its ⋯ menu (Step 2.2).
  const gender = page.getByRole("combobox", { name: "Gender" });
  expect(await tabTo(gender)).toBe(3);
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox", { name: "Gender" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(gender).toHaveValue("Female");
  await expect(page.getByRole("listbox", { name: "Gender" })).toBeHidden();
  // Date of birth, typed; its calendar button, eye and ⋯ follow it.
  expect(await tabTo(label(page, "Date of Birth"))).toBe(3);
  await page.keyboard.type("01-02-1999");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Pick “Date of Birth” from a calendar" })).toBeFocused();
  // Marital status: hide the row with its eye, from the keyboard.
  const eye = page.getByRole("button", { name: "Show “Marital Status” on the biodata" });
  await tabTo(eye);
  await page.keyboard.press("Space");
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  // Escape closes a list without changing the value.
  const tongue = page.getByRole("combobox", { name: "Mother Tongue" });
  await tabTo(tongue);
  await page.keyboard.type("Tel");
  await expect(page.getByRole("listbox", { name: "Mother Tongue" }).getByRole("option")).toHaveText(["Telugu"]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Mother Tongue" })).toBeHidden();
  await expect(tongue).toHaveValue("Tel");
  await expect(status(page)).toHaveText(SAVED);

  const stored = await readStored(page, id);
  expect(storedField(stored, "fullName")?.value).toBe("Asha Rani");
  expect(storedField(stored, "gender")).toMatchObject({ optionKey: "female", value: "Female" });
  expect(storedField(stored, "dateOfBirth")?.value).toBe("1999-02-01");
  expect(storedField(stored, "maritalStatus")?.visible).toBe(false);
  expect(storedField(stored, "motherTongue")?.value).toBe("Tel");
});
