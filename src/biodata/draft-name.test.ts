import { describe, expect, it } from "vitest";
import { createProfile, SAMPLE_PROFILE } from "./defaults";
import { copyName, draftTitle, fullNameOf, isBlankDraft, renameDraft, titleName, type DraftNameWords } from "./draft-name";
import { setFieldValue } from "./edits";
import type { BiodataProfile } from "./types";

const WORDS: DraftNameWords = { named: "{name}'s biodata", untitled: "Untitled biodata", copy: "{name} (copy)" };
const later = () => new Date("2026-11-22T09:00:00.000Z");

function withFullName(value: string): BiodataProfile {
  const profile = createProfile();
  const field = profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.key === "fullName")!;
  return setFieldValue(profile, field.id, value);
}

describe("titleName", () => {
  it.each([
    ["Sai Teja Mandapati", "Sai Teja Mandapati"],
    ["Vusirikala Hari Kiran", "Vusirikala Hari Kiran"],
    ["  Asha   Rani  ", "Asha Rani"],
    ["K. Sai Teja", "K. Sai Teja"],
    ["సాయి తేజ మండపాటి", "సాయి తేజ మండపాటి"],
    ["", ""],
    ["   ", ""],
  ])("%j → %j", (full, name) => {
    expect(titleName(full)).toBe(name);
  });
});

describe("draftTitle", () => {
  it("follows the Full name until the draft has a name of its own", () => {
    expect(draftTitle({ draftName: "", fullName: "" }, WORDS)).toBe("Untitled biodata");
    expect(draftTitle({ draftName: "", fullName: "Sai Teja Mandapati" }, WORDS)).toBe("Sai Teja Mandapati's biodata");
    expect(draftTitle({ draftName: "For the Rao family", fullName: "Sai Teja Mandapati" }, WORDS)).toBe("For the Rao family");
  });

  it("treats a name of only spaces as no name", () => {
    expect(draftTitle({ draftName: "   ", fullName: "Asha Rani" }, WORDS)).toBe("Asha Rani's biodata");
  });

  it("reads the Full name from the draft", () => {
    expect(fullNameOf(withFullName("Asha Rani"))).toBe("Asha Rani");
    expect(fullNameOf(createProfile())).toBe("");
    expect(fullNameOf({ sections: [] })).toBe("");
    expect(fullNameOf(SAMPLE_PROFILE)).toBe("Sai Teja Mandapati");
  });
});

describe("renameDraft", () => {
  it("stores the trimmed name and touches updatedAt", () => {
    const profile = createProfile({ now: () => new Date("2026-11-20T08:00:00.000Z") });
    const renamed = renameDraft(profile, "  Rao family  ", later);
    expect(renamed).toMatchObject({ draftName: "Rao family", updatedAt: later().toISOString(), revision: profile.revision });
    expect(profile.draftName).toBe("");
  });

  it("returns the same profile when nothing changes", () => {
    const profile = createProfile({ draftName: "Mine" });
    expect(renameDraft(profile, "Mine ", later)).toBe(profile);
  });

  it("an empty name goes back to the automatic one", () => {
    const named = renameDraft(withFullName("Asha Rani"), "Mine", later);
    const cleared = renameDraft(named, "   ", later);
    expect(cleared.draftName).toBe("");
    expect(draftTitle({ draftName: cleared.draftName, fullName: fullNameOf(cleared) }, WORDS)).toBe("Asha Rani's biodata");
  });
});

describe("copyName", () => {
  it("adds (copy)", () => {
    expect(copyName("Sai Teja Mandapati's biodata", WORDS)).toBe("Sai Teja Mandapati's biodata (copy)");
  });
});

describe("isBlankDraft", () => {
  it("is true only for a draft with nothing in it", () => {
    expect(isBlankDraft(createProfile())).toBe(true);
    expect(isBlankDraft(withFullName("A"))).toBe(false);
    expect(isBlankDraft(withFullName("   "))).toBe(true);
    expect(isBlankDraft(createProfile({ draftName: "Mine" }))).toBe(false);
    expect(isBlankDraft(SAMPLE_PROFILE)).toBe(false);
  });

  it("counts family details and photos", () => {
    const profile = createProfile();
    const sections = profile.sections.map((s) =>
      s.kind === "family" ? { ...s, members: s.members.map((m, i) => (i === 0 ? { ...m, details: "Retired teacher" } : m)) } : s,
    );
    expect(isBlankDraft({ ...profile, sections })).toBe(false);
    const crop = { x: 0, y: 0, zoom: 1, rotation: 0 as const };
    expect(isBlankDraft({ ...profile, photo: { id: "p", crop, frame: "3:4" } })).toBe(false);
  });
});
