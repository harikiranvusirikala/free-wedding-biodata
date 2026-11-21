// How this site's storage stands in this browser (BUILD_PLAN Step 1.4, VISION §9 "Important browser-storage
// limitation"): how much it uses (navigator.storage.estimate()) and whether the browser has promised to keep it
// when space runs low (persisted() / persist()). Every part is feature-detected: Safari before 15.2 and some
// in-app browsers have none of it, and nothing here may stop anyone from using the editor (§9: "never block use
// if rejected"). Browser code with the StorageManager passed in, so it is unit-tested with a fake one.

type StorageLike = Partial<Pick<StorageManager, "estimate" | "persisted" | "persist">>;

export interface StorageStatus {
  /** Bytes this site's storage uses as the browser reports it (it may round or pad), or null when it can't say. */
  usage: number | null;
  /** True when the browser keeps this site's data until the user clears it; null when it can't say. */
  persisted: boolean | null;
  /** The browser can be asked to keep it (persist() exists and it isn't kept yet). */
  canAsk: boolean;
}

/** What the browser said to "Keep my drafts safe". */
export type PersistAnswer = "granted" | "declined" | "unsupported" | "failed";

function browserStorage(): StorageLike | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.storage;
}

export async function readStorageStatus(storage: StorageLike | undefined = browserStorage()): Promise<StorageStatus> {
  const [usage, persisted] = await Promise.all([
    typeof storage?.estimate === "function"
      ? storage
          .estimate()
          .then((estimate) => (typeof estimate.usage === "number" ? estimate.usage : null))
          .catch(() => null)
      : null,
    typeof storage?.persisted === "function" ? storage.persisted().catch(() => null) : null,
  ]);
  return { usage, persisted, canAsk: typeof storage?.persist === "function" && persisted !== true };
}

/**
 * Asks the browser to keep this site's storage. Browsers decide by their own rules (Chrome by how much the site
 * is used or whether it is installed or bookmarked, Safari and Firefox differently) and may say no without
 * asking the person, so the answer is reported as it is.
 */
export async function requestPersistence(storage: StorageLike | undefined = browserStorage()): Promise<PersistAnswer> {
  if (typeof storage?.persist !== "function") return "unsupported";
  try {
    return (await storage.persist()) ? "granted" : "declined";
  } catch {
    return "failed";
  }
}

/** "340 KB", "1.2 MB", "2 GB" (powers of 1000, as phones and computers show file sizes). At least "1 KB". */
export function formatBytes(bytes: number, locale?: string): string {
  const units = [
    { unit: "gigabyte", size: 1e9 },
    { unit: "megabyte", size: 1e6 },
  ];
  for (const { unit, size } of units) {
    if (bytes >= size) {
      return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "short", maximumFractionDigits: 1 }).format(bytes / size);
    }
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: "kilobyte", unitDisplay: "short", maximumFractionDigits: 0 }).format(Math.max(1, Math.round(bytes / 1000)));
}
