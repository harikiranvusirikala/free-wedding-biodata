import { describe, expect, it } from "vitest";
import { draftUsage, formatBytes, readStorageStatus, requestPersistence } from "./storage-status";

const estimate = (usage?: number) => async () => ({ usage, quota: 1e10 }) as StorageEstimate;

describe("readStorageStatus", () => {
  it("reports usage and persistence when the browser has both", async () => {
    expect(await readStorageStatus({ estimate: estimate(1_234_567), persisted: async () => false, persist: async () => true })).toEqual({
      usage: 1_234_567,
      persisted: false,
      canAsk: true,
    });
  });

  it("leaves out the offline copy of the app where the browser says how big it is (Chrome's usageDetails)", async () => {
    const withDetails = async () => ({ usage: 9_000_000, quota: 1e10, usageDetails: { indexedDB: 1_000_000, caches: 7_900_000, serviceWorkerRegistrations: 100_000 } }) as StorageEstimate;
    expect((await readStorageStatus({ estimate: withDetails })).usage).toBe(1_000_000);
    expect(draftUsage({ usage: 500, usageDetails: { caches: 800 } } as StorageEstimate)).toBe(0);
    expect(draftUsage({ usage: 500 })).toBe(500); // Safari and Firefox: the whole site
    expect(draftUsage({})).toBeNull();
  });

  it("doesn't offer to ask again once storage is kept", async () => {
    const status = await readStorageStatus({ estimate: estimate(10), persisted: async () => true, persist: async () => true });
    expect(status).toMatchObject({ persisted: true, canAsk: false });
  });

  it("says it can't tell when the browser has no StorageManager or parts of it", async () => {
    expect(await readStorageStatus(undefined)).toEqual({ usage: null, persisted: null, canAsk: false });
    expect(await readStorageStatus({})).toEqual({ usage: null, persisted: null, canAsk: false });
    expect(await readStorageStatus({ estimate: estimate(undefined) })).toEqual({ usage: null, persisted: null, canAsk: false });
  });

  it("treats a call that fails as unknown, never as an error for the editor", async () => {
    const fail = async () => {
      throw new DOMException("no", "SecurityError");
    };
    expect(await readStorageStatus({ estimate: fail, persisted: fail, persist: async () => true })).toEqual({ usage: null, persisted: null, canAsk: true });
  });
});

describe("requestPersistence", () => {
  it("reports the browser's answer as it is", async () => {
    expect(await requestPersistence({ persist: async () => true })).toBe("granted");
    expect(await requestPersistence({ persist: async () => false })).toBe("declined");
    expect(await requestPersistence({})).toBe("unsupported");
    expect(await requestPersistence(undefined)).toBe("unsupported");
    expect(
      await requestPersistence({
        persist: async () => {
          throw new Error("x");
        },
      }),
    ).toBe("failed");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "1 kB"],
    [400, "1 kB"],
    [340_000, "340 kB"],
    [1_234_567, "1.2 MB"],
    [25_000_000, "25 MB"],
    [2_000_000_000, "2 GB"],
  ])("%d → %s", (bytes, text) => {
    expect(formatBytes(bytes, "en-IN")).toBe(text);
  });
});
