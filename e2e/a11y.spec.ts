import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openStoredDraft, sampleDraft, showTool } from "./editor-helpers";

// Step 6.2 (VISION D16, WCAG 2.2 AA): axe-core's WCAG 2.0, 2.1 and 2.2 A/AA rules on every public page and the
// editor's main states, in Day and Night, on a phone and a desktop. The biodata preview is left out: it is the printed
// page, whose colours are checked by the palette contrast tests (D51, D56), and it is hidden from screen readers.

const AXE = readFileSync(resolve(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const THEMES = ["light", "dark"] as const;

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

async function violations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: AXE });
  const found = await page.evaluate(async (tags) => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: Violation[] }> } }).axe;
    const result = await axe.run({ exclude: [['[data-testid="preview-pages"]'], ["[data-extra-page]"]] }, { runOnly: { type: "tag", values: tags } });
    return result.violations;
  }, TAGS);
  return found.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${v.help} at ${n.target.join(" ")}`));
}

const PAGES = ["/", "/templates", "/guide", "/te", "/biodata-format/muslim", "/help", "/privacy", "/no-such-page"];

for (const path of PAGES) {
  test(`${path} meets WCAG 2.2 AA (axe), Day and Night`, async ({ page }) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      expect.soft(await violations(page), `${path} ${theme}`).toEqual([]);
    }
  });
}

test("the editor meets WCAG 2.2 AA (axe): the form, the preview and a dialog, Day and Night", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await openStoredDraft(page, sampleDraft("a11y-editor"));
  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme });
    await page.reload();
    await expect(page.getByTestId("editor-form")).toBeVisible();
    await expect(page.getByTestId("editor-loading")).toHaveCount(0);
    expect.soft(await violations(page), `editor ${theme}`).toEqual([]);

    if (isMobile) {
      await page.getByTestId("preview-pill").click();
      await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
      // Each of the tool tabs' trays (Design opens first).
      const sheet = page.getByRole("dialog", { name: "Preview" });
      for (const tool of ["Design", "Colour", "Text", "Labels"] as const) {
        await showTool(sheet, tool);
        expect.soft(await violations(page), `preview sheet, ${tool} ${theme}`).toEqual([]);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Preview" })).toBeHidden();
    }

    await page.locator('[data-section="personal"]').getByRole("button", { name: /Add a field/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect.soft(await violations(page), `add a field ${theme}`).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});
