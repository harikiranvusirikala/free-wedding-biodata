import { describe, expect, it } from "vitest";
import { SAMPLE_PROFILE } from "./defaults";
import { pageImageFileName, pdfFileName, sanitizeFileName } from "./filename";
import type { BiodataProfile } from "./types";

const withName = (fullName: string): BiodataProfile => {
  const p = structuredClone(SAMPLE_PROFILE) as BiodataProfile;
  for (const s of p.sections) if (s.kind === "fields") for (const f of s.fields) if (f.key === "fullName") f.value = fullName;
  return p;
};

describe("download filenames: <Full name> Biodata", () => {
  it("uses the whole Full name", () => {
    expect(pdfFileName(SAMPLE_PROFILE)).toBe("Sai Teja Mandapati Biodata.pdf");
    expect(pdfFileName(withName("Vusirikala Hari Kiran"))).toBe("Vusirikala Hari Kiran Biodata.pdf");
    expect(pageImageFileName(SAMPLE_PROFILE, 1, "jpeg", 2)).toBe("Sai Teja Mandapati Biodata - page 1.jpg");
    expect(pageImageFileName(SAMPLE_PROFILE, 2, "png", 2)).toBe("Sai Teja Mandapati Biodata - page 2.png");
    expect(pageImageFileName(SAMPLE_PROFILE, 1, "jpeg", 1)).toBe("Sai Teja Mandapati Biodata.jpg");
    expect(pageImageFileName(SAMPLE_PROFILE, 1)).toBe("Sai Teja Mandapati Biodata - page 1.jpg");
  });

  it("keeps any script, initials, apostrophes and hyphens; tidies spaces", () => {
    expect(pdfFileName(withName("సాయి తేజ మండపాటి"))).toBe("సాయి తేజ మండపాటి Biodata.pdf");
    expect(pdfFileName(withName("  K.  Sai   Teja "))).toBe("K Sai Teja Biodata.pdf");
    expect(pdfFileName(withName("Anita D'Souza-Rao"))).toBe("Anita D'Souza-Rao Biodata.pdf");
    expect(sanitizeFileName("श्रीकांत")).toBe("श्रीकांत");
  });

  it("drops anything unsafe on some system", () => {
    expect(pdfFileName(withName("../../etc/passwd"))).toBe("etc passwd Biodata.pdf");
    expect(pdfFileName(withName('Ra"vi<>:*?|'))).toBe("Ra vi Biodata.pdf");
    expect(pdfFileName(withName("Priya\u0000\u202e"))).toBe("Priya Biodata.pdf");
    expect(pdfFileName(withName("🙂 Anu"))).toBe("Anu Biodata.pdf");
  });

  it("falls back to Marriage Biodata without a name", () => {
    expect(pdfFileName(withName(""))).toBe("Marriage Biodata.pdf");
    expect(pdfFileName(withName("   ...  "))).toBe("Marriage Biodata.pdf");
    expect(pageImageFileName(withName(""), 3, "jpeg", 3)).toBe("Marriage Biodata - page 3.jpg");
  });

  it("caps a very long name between letters", () => {
    expect(sanitizeFileName("A".repeat(80))).toHaveLength(60);
    const telugu = sanitizeFileName("క్ష".repeat(50));
    expect(telugu.length % "క్ష".length).toBe(0);
    expect(sanitizeFileName("Ab ".repeat(30))).not.toMatch(/\s$/);
  });
});
