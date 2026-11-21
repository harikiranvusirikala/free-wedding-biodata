import { describe, expect, it } from "vitest";
import { getDocDictionary } from "@/i18n/doc";
import { ageOn, formatAge, formatDate, formatHeight, formatTime, parseIsoDate } from "./format";

const en = getDocDictionary("en");
const te = getDocDictionary("te");

describe("formatDate", () => {
  it("prints DD-MM-YYYY by default and the two month-name styles (D14, D28)", () => {
    expect(formatDate("1997-08-22", "dd-mm-yyyy", en)).toBe("22-08-1997");
    expect(formatDate("1997-08-22", "d month yyyy", en)).toBe("22 August 1997");
    expect(formatDate("1997-08-22", "d-month-yyyy", en)).toBe("22-August-1997");
    expect(formatDate("1998-03-05", "d month yyyy", en)).toBe("5 March 1998");
  });

  it("uses the document language's month names", () => {
    expect(formatDate("1997-08-22", "d-month-yyyy", te)).toBe("22-ఆగస్టు-1997");
  });

  it("prints anything that isn't a real date exactly as typed (trimmed)", () => {
    expect(formatDate(" Aug 1997 ", "d month yyyy", en)).toBe("Aug 1997");
    expect(formatDate("1997-02-30", "dd-mm-yyyy", en)).toBe("1997-02-30");
    expect(parseIsoDate("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseIsoDate("1900-02-29")).toBeNull();
  });
});

describe("formatTime", () => {
  it("prints 12-hour time with AM/PM (§6)", () => {
    expect(formatTime("06:45", en)).toBe("6:45 AM");
    expect(formatTime("00:05", en)).toBe("12:05 AM");
    expect(formatTime("12:00", en)).toBe("12:00 PM");
    expect(formatTime("22:55", en)).toBe("10:55 PM");
  });

  it("prints a typed time as typed", () => {
    expect(formatTime("early morning", en)).toBe("early morning");
    expect(formatTime("25:00", en)).toBe("25:00");
  });
});

describe("formatHeight", () => {
  it("prints the picked format from centimetres (D13)", () => {
    expect(formatHeight("178", "ft-in", en)).toBe(`5' 10"`);
    expect(formatHeight("178", "cm", en)).toBe("178 cm");
    expect(formatHeight("178", "ft-in-cm", en)).toBe(`5' 10" (178 cm)`);
    expect(formatHeight("152.4", "ft-in", en)).toBe(`5' 0"`);
    expect(formatHeight("182.88", "ft-in", en)).toBe(`6' 0"`);
  });

  it("uses the document language's unit and keeps typed text", () => {
    expect(formatHeight("165", "cm", te)).toBe("165 సెం.మీ.");
    expect(formatHeight(`5 ft 8 in`, "cm", en)).toBe("5 ft 8 in");
  });
});

describe("ageOn", () => {
  it("counts completed years on the given day (D13)", () => {
    expect(ageOn("1996-08-14", new Date(2026, 7, 13))).toBe(29);
    expect(ageOn("1996-08-14", new Date(2026, 7, 14))).toBe(30);
    expect(ageOn("2000-02-29", new Date(2026, 1, 28))).toBe(25);
    expect(ageOn("2000-02-29", new Date(2026, 2, 1))).toBe(26);
  });

  it("gives nothing for an unreadable or future date", () => {
    expect(ageOn("sometime", new Date(2026, 0, 1))).toBeNull();
    expect(ageOn("2030-01-01", new Date(2026, 0, 1))).toBeNull();
  });

  it("prints years in the document language", () => {
    expect(formatAge(30, en)).toBe("30 years");
    expect(formatAge(30, te)).toBe("30 సంవత్సరాలు");
  });
});
