import { describe, expect, it } from "vitest";
import {
  HEIGHT_INCHES,
  capitalizeFirst,
  dateTextToValue,
  dateToText,
  filterChoices,
  heightToInches,
  inchesToCm,
  matchChoice,
  parseDateText,
  parseTimeText,
  splitInches,
  timeTextToValue,
  timeToText,
} from "./inputs";

describe("dates", () => {
  it("reads day-first dates in the ways people type them", () => {
    for (const text of ["15-03-1998", "15/03/1998", "15.03.1998", "15 03 1998", "15-3-1998", " 15 - 03 - 1998 "]) {
      expect(parseDateText(text), text).toBe("1998-03-15");
    }
  });

  it("reads month names and ISO dates", () => {
    expect(parseDateText("15 March 1998")).toBe("1998-03-15");
    expect(parseDateText("15-Mar-1998")).toBe("1998-03-15");
    expect(parseDateText("15th Sept, 1998")).toBe("1998-09-15");
    expect(parseDateText("1998-03-15")).toBe("1998-03-15");
  });

  it("refuses what isn't a whole, real date", () => {
    for (const text of ["", "15-03-98", "31-02-1998", "15-13-1998", "15 Ma 1998", "15 Marx 1998", "1998-02-30", "15-03-199", "next year"]) {
      expect(parseDateText(text), text).toBeNull();
    }
  });

  it("stores the ISO date, or the text exactly as typed (never lost)", () => {
    expect(dateTextToValue("15-03-1998")).toBe("1998-03-15");
    expect(dateTextToValue("15-03-199")).toBe("15-03-199");
    expect(dateTextToValue("around 1998 ")).toBe("around 1998 ");
  });

  it("shows a stored date as dd-mm-yyyy, and free text (Step 1.3's) as it was", () => {
    expect(dateToText("1998-03-15")).toBe("15-03-1998");
    expect(dateToText("15 March 1998")).toBe("15 March 1998");
    expect(dateToText("")).toBe("");
  });

  it("round-trips", () => {
    expect(dateTextToValue(dateToText("2001-12-01"))).toBe("2001-12-01");
  });
});

describe("times", () => {
  it("reads 12-hour times with AM/PM", () => {
    expect(parseTimeText("6:45 AM")).toBe("06:45");
    expect(parseTimeText("6.45pm")).toBe("18:45");
    expect(parseTimeText("6 pm")).toBe("18:00");
    expect(parseTimeText("645 p.m.")).toBe("18:45");
    expect(parseTimeText("12:10 AM")).toBe("00:10");
    expect(parseTimeText("12:10 pm")).toBe("12:10");
  });

  it("reads 24-hour times", () => {
    expect(parseTimeText("06:45")).toBe("06:45");
    expect(parseTimeText("18:45")).toBe("18:45");
    expect(parseTimeText("0:05")).toBe("00:05");
  });

  it("refuses what isn't a time", () => {
    for (const text of ["", "13:00 pm", "0:30 am", "24:00", "6:60", "early morning", "6"]) {
      expect(parseTimeText(text), text).toBeNull();
    }
  });

  it("stores HH:mm or the text as typed, and shows 12-hour time", () => {
    expect(timeTextToValue("6:40 am")).toBe("06:40");
    expect(timeTextToValue("about 6")).toBe("about 6");
    expect(timeToText("06:40")).toBe("6:40 AM");
    expect(timeToText("00:05")).toBe("12:05 AM");
    expect(timeToText("12:00")).toBe("12:00 PM");
    expect(timeToText("23:59")).toBe("11:59 PM");
    expect(timeToText("about 6")).toBe("about 6");
  });
});

describe("height", () => {
  it("stores whole centimetres for feet and inches", () => {
    expect(inchesToCm(70)).toBe("178");
    expect(splitInches(70)).toEqual({ ft: 5, in: 10 });
  });

  it("finds the picker's choice for a stored height", () => {
    expect(heightToInches("178")).toBe(70);
    expect(heightToInches("176")).toBe(69);
    expect(heightToInches("165.5")).toBe(65);
    expect(heightToInches("")).toBeNull();
    expect(heightToInches("5 feet 10")).toBeNull();
    expect(heightToInches("30")).toBeNull();
  });

  it("every choice round-trips exactly through centimetres", () => {
    for (let inches = HEIGHT_INCHES.min; inches <= HEIGHT_INCHES.max; inches++) {
      expect(heightToInches(inchesToCm(inches))).toBe(inches);
    }
  });
});

describe("select with a typed value", () => {
  const choices = [
    { key: "neverMarried", label: "Never Married" },
    { key: "divorced", label: "Divorced" },
    { key: "awaitingDivorce", label: "Awaiting Divorce" },
  ];

  it("treats typing an option's name in full as picking it", () => {
    expect(matchChoice(" never married ", choices)?.key).toBe("neverMarried");
    expect(matchChoice("Never", choices)).toBeUndefined();
    expect(matchChoice("", choices)).toBeUndefined();
  });

  it("filters while typing, matches at the start first", () => {
    expect(filterChoices("div", choices).map((c) => c.key)).toEqual(["divorced", "awaitingDivorce"]);
    expect(filterChoices("", choices)).toHaveLength(3);
    expect(filterChoices("xyz", choices)).toEqual([]);
  });
});

describe("first letter in capitals (D47)", () => {
  it("capitalises Latin text and leaves the rest as typed", () => {
    expect(capitalizeFirst("software engineer")).toBe("Software engineer");
    expect(capitalizeFirst("  b.Tech")).toBe("  B.Tech");
    expect(capitalizeFirst("élan")).toBe("Élan");
  });

  it("never changes Indian scripts, digits or text already capitalised", () => {
    for (const text of ["సాయి తేజ", "साई तेज", "+91 90000 00001", "Hyderabad", "", "   ", "ß", "iPhone repair"]) {
      expect(capitalizeFirst(text), text).toBe(text);
    }
  });
});
