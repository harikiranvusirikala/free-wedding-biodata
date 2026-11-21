import { describe, expect, it } from "vitest";
import { SAMPLE_PROFILE } from "./defaults";
import { fileFirstName, pageImageFileName, pdfFileName, sanitizeFilePart } from "./filename";
import type { BiodataProfile } from "./types";

const withName = (fullName: string): BiodataProfile => {
  const p = structuredClone(SAMPLE_PROFILE) as BiodataProfile;
  for (const s of p.sections) if (s.kind === "fields") for (const f of s.fields) if (f.key === "fullName") f.value = fullName;
  return p;
};

describe("pdfFileName", () => {
  it("uses the first name of the sample profile", () => {
    expect(pdfFileName(SAMPLE_PROFILE)).toBe("Marriage-Biodata-Sai.pdf");
    expect(pageImageFileName(SAMPLE_PROFILE, 1)).toBe("Marriage-Biodata-Sai-page-1.jpg");
    expect(pageImageFileName(SAMPLE_PROFILE, 2, "png")).toBe("Marriage-Biodata-Sai-page-2.png");
  });

  it("skips initials and keeps Indian scripts whole", () => {
    expect(fileFirstName("K. Sai Teja")).toBe("Sai");
    expect(fileFirstName("K.S. Lakshmi")).toBe("Lakshmi");
    expect(pdfFileName(withName("సాయి తేజ మండపాటి"))).toBe("Marriage-Biodata-సాయి.pdf");
    expect(fileFirstName("श्रीकांत")).toBe("श्रीकांत");
  });

  it("sanitises anything unsafe in a filename", () => {
    expect(pdfFileName(withName("../../etc/passwd"))).toBe("Marriage-Biodata-etc-passwd.pdf");
    expect(pdfFileName(withName('Ra"vi<>:*?|'))).toBe("Marriage-Biodata-Ra-vi.pdf");
    expect(pdfFileName(withName("Priya\u0000‮"))).toBe("Marriage-Biodata-Priya.pdf");
    expect(pdfFileName(withName("🙂 Anu"))).toBe("Marriage-Biodata-Anu.pdf");
    expect(sanitizeFilePart("Mary-Ann")).toBe("Mary-Ann");
  });

  it("falls back to the plain name with no usable name", () => {
    expect(pdfFileName(withName(""))).toBe("Marriage-Biodata.pdf");
    expect(pdfFileName(withName("   ...  "))).toBe("Marriage-Biodata.pdf");
    expect(pageImageFileName(withName(""), 3)).toBe("Marriage-Biodata-page-3.jpg");
  });

  it("keeps a very long name to 40 characters without splitting a cluster", () => {
    const name = fileFirstName("A".repeat(80));
    expect(name).toHaveLength(40);
    const telugu = fileFirstName("క్ష".repeat(50));
    expect([...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(telugu)]).toHaveLength(40);
    expect(telugu.endsWith("క్ష")).toBe(true);
  });
});
