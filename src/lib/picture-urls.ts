// Pictures drawn for the pages after the biodata (Step 4.2b) are shown through blob: URLs, not base64 data URLs: eight
// photos at 300 dpi would otherwise put some 20 MB of text in the page's attributes, the preview's copy, the
// export's copy and React's props. This module remembers which Blob stands behind each URL, so the Download engine
// can embed the very bytes (src/pdf/index.ts) instead of fetching the URL: the editor's CSP (`connect-src 'self'`)
// doesn't allow fetching a blob: address, though showing one in an <img> is fine (`img-src … blob:`).

const blobs = new Map<string, Blob>();

/** How long a URL stays valid after it is let go: an export or a print may still be reading the copy of a page. */
export const URL_GRACE_MS = 60_000;

/** A blob: URL for `blob`, remembered until `releasePictureUrl`. */
export function pictureUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  blobs.set(url, blob);
  return url;
}

/** The Blob behind a URL made by `pictureUrl` (until it is released), else undefined. */
export function pictureBlob(url: string): Blob | undefined {
  return blobs.get(url);
}

/** Lets a URL go after a grace period (the page, its export copy or the printer may still be using it). */
export function releasePictureUrl(url: string, afterMs: number = URL_GRACE_MS): void {
  if (!blobs.has(url)) return;
  setTimeout(() => {
    blobs.delete(url);
    URL.revokeObjectURL(url);
  }, afterMs);
}
