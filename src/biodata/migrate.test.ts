import { describe, expect, it } from "vitest";
import { SAMPLE_PROFILE, createProfile } from "./defaults";
import { migrate } from "./migrate";

const draft = () => createProfile({ newId: () => crypto.randomUUID(), now: () => new Date("2026-11-21T10:00:00.000Z") });

describe("migrate", () => {
  it("accepts a valid version 1 profile as it is", () => {
    const profile = draft();
    const result = migrate(profile);
    expect(result).toEqual({ ok: true, profile, fromVersion: 1 });
  });

  it("accepts a profile that went through JSON (database and backup files)", () => {
    const result = migrate(JSON.parse(JSON.stringify(SAMPLE_PROFILE)));
    expect(result.ok && result.profile).toEqual(SAMPLE_PROFILE);
  });

  it("doesn't change its input", () => {
    const raw = { ...draft(), extra: "kept by the caller" };
    const before = structuredClone(raw);
    migrate(raw);
    expect(raw).toEqual(before);
  });

  it("refuses a profile from a newer release with a clear reason", () => {
    const result = migrate({ ...draft(), schemaVersion: 2 });
    expect(result).toEqual({
      ok: false,
      error: { code: "too-new", message: "Saved in format 2, but this version of the app reads formats up to 1" },
    });
  });

  it.each([null, undefined, 42, "a profile", [], true])("refuses %j as not a profile", (raw) => {
    const result = migrate(raw);
    expect(!result.ok && result.error.code).toBe("not-a-profile");
  });

  it.each([{}, { schemaVersion: "1" }, { schemaVersion: 0 }, { schemaVersion: 1.5 }, { schemaVersion: -3 }])(
    "refuses %j, which has no usable schemaVersion",
    (raw) => {
      const result = migrate(raw);
      expect(!result.ok && result.error.code).toBe("not-a-profile");
    },
  );

  it("explains where a broken version 1 profile is wrong", () => {
    const result = migrate({ ...draft(), docLanguage: "fr", revision: "3" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid");
    expect(result.error.message).toContain("docLanguage");
    expect(result.error.message).toContain("revision");
  });

  it("never throws, even on hostile input", () => {
    const hostile = { schemaVersion: 1, sections: { length: 1e9 }, ["__proto__"]: { polluted: true } };
    expect(() => migrate(hostile)).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
