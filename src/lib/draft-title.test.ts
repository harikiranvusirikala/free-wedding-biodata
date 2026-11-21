import { describe, expect, it } from "vitest";
import { copyTitleOf, editedAgo, titleOf } from "./draft-title";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("titleOf", () => {
  it("uses the app's words", () => {
    expect(titleOf({ draftName: "", fullName: "" })).toBe("Untitled biodata");
    expect(titleOf({ draftName: "", fullName: "Sai Teja Mandapati" })).toBe("Sai Teja's biodata");
    expect(titleOf({ draftName: "Mine", fullName: "Sai Teja Mandapati" })).toBe("Mine");
    expect(copyTitleOf({ draftName: "", fullName: "Asha Rani" })).toBe("Asha's biodata (copy)");
  });
});

describe("editedAgo", () => {
  it.each([
    [0, "Edited just now"],
    [59_000, "Edited just now"],
    [5 * 60_000, "Edited 5 minutes ago"],
    [3 * 3_600_000, "Edited 3 hours ago"],
    [26 * 3_600_000, "Edited yesterday"],
    [3 * 86_400_000, "Edited 3 days ago"],
    [10 * 86_400_000, "Edited 11 Nov 2026"],
  ])("%d ms ago → %s", (ms, text) => {
    expect(editedAgo(ago(ms), NOW, "en-GB")).toBe(text);
  });

  it("treats a time in the future (another device's clock) as just now, and an unreadable one as nothing", () => {
    expect(editedAgo(ago(-60_000), NOW, "en-GB")).toBe("Edited just now");
    expect(editedAgo("", NOW)).toBe("");
    expect(editedAgo("not a date", NOW)).toBe("");
  });
});
