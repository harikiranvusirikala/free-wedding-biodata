import { describe, expect, test } from "vitest";
import en from "@/i18n/app/en.json";
import { t } from "./i18n";

describe("app dictionary", () => {
  test("t() returns the English text", () => {
    expect(t("theme.dark")).toBe("Night");
  });

  test("placeholders are filled; a missing value stays visible", () => {
    expect(t("footer.copyright", { year: 2026, name: "Free Wedding Biodata" })).toBe("© 2026 Free Wedding Biodata");
    expect(t("footer.copyright", { year: 2026 })).toBe("© 2026 {name}");
  });

  test("every entry has words, and only <b> as markup (Rich understands nothing else)", () => {
    for (const [key, text] of Object.entries(en)) {
      expect(text.trim(), key).not.toBe("");
      expect(text.replace(/<\/?b>/g, ""), key).not.toMatch(/<[a-z/]/i);
    }
  });
});
