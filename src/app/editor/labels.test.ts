import { describe, expect, it } from "vitest";
import { defaultFieldLabel, defaultSectionTitle, effectiveLabelStyle, fieldLabel, sectionTitle } from "./labels";

// The form shows the words the English page prints (D53): with Telugu families' wording, exactly four field labels
// change; renamed labels keep the user's words; a page in another language keeps the form standard.

describe("the form's labels in the Telugu families' wording", () => {
  it("changes Nakshatra, Rashi, Gotra and Maternal Gotra only", () => {
    expect(fieldLabel({ key: "nakshatra" }, "telugu")).toBe("Star");
    expect(fieldLabel({ key: "rashi" }, "telugu")).toBe("Raasi");
    expect(fieldLabel({ key: "gotra" }, "telugu")).toBe("Swagothram");
    expect(fieldLabel({ key: "maternalGotra" }, "telugu")).toBe("Maternal Gothram");
    expect(defaultFieldLabel({ key: "nakshatra" }, "telugu")).toBe("Star");
    for (const key of ["dateOfBirth", "birthTime", "birthPlace", "highestQualification", "occupation", "annualIncome"]) {
      expect(fieldLabel({ key }, "telugu"), key).toBe(fieldLabel({ key }, "standard"));
    }
    expect(sectionTitle({ key: "contact" }, "telugu")).toBe("Contact Details");
    expect(defaultSectionTitle({ key: "horoscope" }, "telugu")).toBe(defaultSectionTitle({ key: "horoscope" }));
  });

  it("keeps a renamed label, and the standard words when the page isn't in English", () => {
    expect(fieldLabel({ key: "nakshatra", label: "Janma Nakshatram" }, "telugu")).toBe("Janma Nakshatram");
    expect(fieldLabel({ key: "nakshatra" })).toBe("Nakshatra");
    expect(effectiveLabelStyle({ labelStyle: "telugu" }, "en")).toBe("telugu");
    expect(effectiveLabelStyle({ labelStyle: "telugu" }, "te")).toBe("standard");
    expect(effectiveLabelStyle({}, "en")).toBe("standard");
  });
});
