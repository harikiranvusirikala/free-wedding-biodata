import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_UNICODE_RANGE } from "@/document/tokens";
import { parseUnicodeRange, unicodeRangeTest } from "./unicode-range";

describe("parseUnicodeRange", () => {
  it("reads single code points, ranges and wildcards", () => {
    expect(parseUnicodeRange("U+0020, U+0C80-0CFF, u+20??")).toEqual([
      [0x20, 0x20],
      [0xc80, 0xcff],
      [0x2000, 0x20ff],
    ]);
    expect(() => parseUnicodeRange("0C80")).toThrow();
  });

  it("tests code points", () => {
    const kannada = unicodeRangeTest(FONT_UNICODE_RANGE["Noto Sans Kannada"]);
    expect(kannada(0xc95)).toBe(true); // ಕ
    expect(kannada(0x20)).toBe(true); // the space stays in the script font
    expect(kannada(0x200d)).toBe(true); // ZWJ
    expect(kannada(0x41)).toBe(false); // A → Noto Sans
    expect(kannada(0x31)).toBe(false); // 1 → Noto Sans
    expect(kannada(0x20b9)).toBe(false); // ₹ → Noto Sans
  });
});

describe("FONT_UNICODE_RANGE", () => {
  it("is exactly what document.css gives each script font's faces", () => {
    const css = readFileSync(path.join(process.cwd(), "src/document/document.css"), "utf8");
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
    const found = new Map<string, Set<string>>();
    for (const face of faces) {
      const family = /font-family:\s*"([^"]+)"/.exec(face)![1];
      const range = /unicode-range:\s*([^;]+);/.exec(face)?.[1].trim() ?? "";
      found.set(family, new Set([...(found.get(family) ?? []), range]));
    }
    expect(found.get("Noto Sans")).toEqual(new Set([""]));
    for (const [family, range] of Object.entries(FONT_UNICODE_RANGE)) expect(found.get(family), family).toEqual(new Set([range]));
    expect([...found.keys()].sort()).toEqual(["Noto Sans", ...Object.keys(FONT_UNICODE_RANGE)].sort());
  });
});
