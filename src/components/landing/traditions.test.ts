import { describe, expect, it } from "vitest";
import { chipFields, personalRows } from "./traditions";

// The tradition pages describe exactly what the editor's chips add (TRADITION_FIELD_SETS), and leave the horoscope
// out where families don't print it.

describe("tradition pages", () => {
  it("Hindu: the horoscope rows; the chips add the regional ones", () => {
    expect(personalRows("hindu")).toEqual(expect.arrayContaining(["birthTime", "nakshatra", "rashi", "gotra", "maternalGotra"]));
    expect(chipFields("hindu")).toEqual(["intiPeru", "lagnam", "dosham", "kulaDevata", "devak", "gan", "nadi"]);
  });

  it.each([
    ["muslim", ["muslimSect", "maslak"]],
    ["christian", ["denomination", "church"]],
    ["sikh", ["sikhPractice", "gotra"]],
    ["jain", ["jainSect", "gotra", "caste"]],
  ] as const)("%s: its own rows, no nakshatra or rashi", (page, own) => {
    const rows = personalRows(page);
    expect(rows).toEqual(expect.arrayContaining([...own]));
    expect(rows).not.toContain("nakshatra");
    expect(rows).not.toContain("rashi");
    expect(rows[0]).toBe("fullName");
  });
});
