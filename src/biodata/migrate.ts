import { profileSchema } from "./schema";
import { CURRENT_SCHEMA_VERSION, type BiodataProfile } from "./types";

// Turns whatever was read (a database record or a profile inside a backup file) into a current, valid profile, or
// says why it can't. The database (Step 1.3) and backups (Step 5.1) share this, so a draft saved by any earlier
// release opens the same way from either. It never throws and never changes its input: a record that fails is
// kept untouched by the caller and reported, never deleted.

export type MigrateErrorCode =
  /** Not a profile at all: not an object, or no usable schemaVersion. */
  | "not-a-profile"
  /** Saved by a newer release than this one; reloading the app gets the newer code. */
  | "too-new"
  /** Looks like a profile of a known version but fails validation. */
  | "invalid";

export interface MigrateError {
  code: MigrateErrorCode;
  /** For logs and bug reports; the app shows its own words from the app dictionary, chosen by `code`. */
  message: string;
}

export type MigrateResult =
  | {
      ok: true;
      profile: BiodataProfile;
      /** The version it was saved in, so callers know to re-save an upgraded record. */
      fromVersion: number;
    }
  | { ok: false; error: MigrateError };

type RawProfile = Record<string, unknown>;

/**
 * Upgrades from version n to n + 1, keyed by n. Each one takes the previous version's shape and must not mutate
 * it. Empty while only version 1 exists; the first change to the saved format adds `1: (raw) => ({ ...raw, … })`
 * and bumps CURRENT_SCHEMA_VERSION, with a test that a version 1 record still opens.
 */
const UPGRADES: Record<number, (raw: RawProfile) => RawProfile> = {};

export function migrate(raw: unknown): MigrateResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail("not-a-profile", "Expected a profile object");
  }
  let data = raw as RawProfile;
  const version = data.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return fail("not-a-profile", `Unknown schemaVersion ${JSON.stringify(version)}`);
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return fail(
      "too-new",
      `Saved in format ${version}, but this version of the app reads formats up to ${CURRENT_SCHEMA_VERSION}`,
    );
  }

  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const upgrade = UPGRADES[v];
    if (!upgrade) return fail("invalid", `No upgrade from format ${v}`);
    data = { ...upgrade(data), schemaVersion: v + 1 };
  }

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(profile)"}: ${issue.message}`)
      .join("; ");
    return fail("invalid", `Not a valid profile: ${issues}`);
  }
  return { ok: true, profile: parsed.data, fromVersion: version };
}

function fail(code: MigrateErrorCode, message: string): MigrateResult {
  return { ok: false, error: { code, message } };
}
