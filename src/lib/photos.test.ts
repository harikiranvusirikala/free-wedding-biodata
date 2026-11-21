import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES, PHOTO_ACCEPT, checkPhotoFile, fitLongEdge, isHeic, printPixels } from "./photos";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("checkPhotoFile", () => {
  it("accepts JPEG, PNG and WebP", () => {
    expect(checkPhotoFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(checkPhotoFile(file("a.png", "image/png"))).toBeNull();
    expect(checkPhotoFile(file("a.webp", "image/webp"))).toBeNull();
  });

  it("lets HEIC through to be tried (the browser may decode it)", () => {
    expect(checkPhotoFile(file("IMG_0001.HEIC", "image/heic"))).toBeNull();
    expect(checkPhotoFile(file("IMG_0001.heif", ""))).toBeNull();
  });

  it("decides by the name when the browser gives no type", () => {
    expect(checkPhotoFile(file("photo.JPEG", ""))).toBeNull();
    expect(checkPhotoFile(file("notes.txt", ""))).toBe("type");
  });

  it("refuses other files, including GIF and SVG", () => {
    expect(checkPhotoFile(file("a.gif", "image/gif"))).toBe("type");
    expect(checkPhotoFile(file("a.svg", "image/svg+xml"))).toBe("type");
    expect(checkPhotoFile(file("a.pdf", "application/pdf"))).toBe("type");
    // A wrong type wins over a photo-like name.
    expect(checkPhotoFile(file("a.jpg", "text/plain"))).toBe("type");
  });

  it("refuses empty and oversized files", () => {
    expect(checkPhotoFile(file("a.jpg", "image/jpeg", 0))).toBe("empty");
    expect(checkPhotoFile(file("a.jpg", "image/jpeg", MAX_INPUT_BYTES))).toBeNull();
    expect(checkPhotoFile(file("a.jpg", "image/jpeg", MAX_INPUT_BYTES + 1))).toBe("size");
  });
});

describe("isHeic", () => {
  it("knows an iPhone photo by its type or name", () => {
    expect(isHeic({ name: "x", type: "image/HEIC" })).toBe(true);
    expect(isHeic({ name: "IMG.heic", type: "" })).toBe(true);
    expect(isHeic({ name: "IMG.jpg", type: "image/jpeg" })).toBe(false);
  });
});

describe("fitLongEdge", () => {
  it("shrinks the long edge to 3000 px, keeping the shape", () => {
    expect(fitLongEdge(4032, 3024)).toEqual({ width: 3000, height: 2250 });
    expect(fitLongEdge(3024, 4032)).toEqual({ width: 2250, height: 3000 });
  });

  it("never enlarges a small photo", () => {
    expect(fitLongEdge(240, 320)).toEqual({ width: 240, height: 320 });
  });

  it("keeps at least one pixel on a very thin picture", () => {
    expect(fitLongEdge(12000, 1, 3000)).toEqual({ width: 3000, height: 1 });
  });
});

describe("the picker and print sizes", () => {
  it("lists only JPEG, PNG and WebP, so an iPhone converts HEIC photos (VISION §10)", () => {
    expect(PHOTO_ACCEPT.split(",")).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });

  it("works out the pixels a frame needs at 300 dpi", () => {
    expect(printPixels(25.4)).toBe(300);
    expect(printPixels(50.8, 150)).toBe(300);
  });
});
