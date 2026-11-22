import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { URL_GRACE_MS, pictureBlob, pictureUrl, releasePictureUrl } from "./picture-urls";

// Pictures drawn for the photo pages are blob: URLs with a registry behind them, so the Download engine can embed
// the very bytes without fetching the URL (the editor's CSP doesn't allow that).

let made = 0;
const revoked: string[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = () => `blob:test/${++made}`;
  URL.revokeObjectURL = (url: string) => void revoked.push(url);
});
afterEach(() => {
  vi.useRealTimers();
  revoked.length = 0;
});

describe("picture URLs", () => {
  it("remembers the Blob behind a URL until it is released, after a grace period", () => {
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const url = pictureUrl(blob);
    expect(url).toMatch(/^blob:/);
    expect(pictureBlob(url)).toBe(blob);
    releasePictureUrl(url);
    vi.advanceTimersByTime(URL_GRACE_MS - 1);
    expect(pictureBlob(url)).toBe(blob); // an export or a print may still be reading its copy
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(pictureBlob(url)).toBeUndefined();
    expect(revoked).toEqual([url]);
  });

  it("knows nothing about a URL it didn't make", () => {
    expect(pictureBlob("blob:elsewhere/1")).toBeUndefined();
    releasePictureUrl("blob:elsewhere/1");
    vi.runAllTimers();
    expect(revoked).toEqual([]);
  });
});
