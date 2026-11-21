"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_CROP, PRINT_WIDTH_MM, clampCrop } from "@/biodata/photo-crop";
import type { MainPhoto } from "@/biodata/types";
import { Logo } from "@/components/Logo";
import { ThemeMenu } from "@/components/ThemeMenu";
import { PhotoField, type PhotoChange } from "@/components/photo/PhotoField";
import { PageHeader } from "@/components/ui/PageHeader";
import { button } from "@/components/ui/button";
import { card, cardHeader, cardText, cardTitle } from "@/components/ui/card";
import { pageWidth } from "@/components/ui/page";
import { preparePhoto, printPixels, renderCropDataUrl } from "@/lib/photos";
import type { PhotoInput } from "@/lib/profile-repo";

// A development page, never shown to the public, so its demo words are written here rather than in the app
// dictionary (BUILD_PLAN Part B rule 6 covers user-facing text). Storage is a Map standing in for the photos
// table; the picture is drawn on a canvas (never a real person's photo).

/** A made-up portrait scene with coloured corners and a grid, so moving, zooming and turning are easy to see. */
export function drawTestPicture(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  const u = width / 300; // drawn on a 300-wide grid
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#f6d7a7");
  sky.addColorStop(0.6, "#e9b98a");
  sky.addColorStop(1, "#c98f6b");
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  c.strokeStyle = "rgba(255,255,255,0.35)";
  c.lineWidth = Math.max(1, u);
  for (let x = 0; x <= 300; x += 25) {
    c.beginPath();
    c.moveTo(x * u, 0);
    c.lineTo(x * u, height);
    c.stroke();
  }
  for (let y = 0; y <= (300 * height) / width; y += 25) {
    c.beginPath();
    c.moveTo(0, y * u);
    c.lineTo(width, y * u);
    c.stroke();
  }
  // A figure: head, shoulders, a collar (a shape, not a person).
  c.fillStyle = "#8d6e5a";
  c.beginPath();
  c.arc(150 * u, 150 * u, 54 * u, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3d6b5c";
  c.beginPath();
  c.moveTo(40 * u, height);
  c.bezierCurveTo(40 * u, 260 * u, 90 * u, 222 * u, 150 * u, 222 * u);
  c.bezierCurveTo(210 * u, 222 * u, 260 * u, 260 * u, 260 * u, height);
  c.closePath();
  c.fill();
  c.fillStyle = "#f3efe6";
  c.beginPath();
  c.moveTo(128 * u, 224 * u);
  c.lineTo(150 * u, 262 * u);
  c.lineTo(172 * u, 224 * u);
  c.closePath();
  c.fill();
  // Corners: red top-left, blue top-right, green bottom-left, yellow bottom-right.
  const corner = 34 * u;
  for (const [x, y, colour] of [[0, 0, "#c0392b"], [width - corner, 0, "#2463c2"], [0, height - corner, "#2f8f46"], [width - corner, height - corner, "#e2b007"]] as const) {
    c.fillStyle = colour;
    c.fillRect(x, y, corner, corner);
  }
  c.fillStyle = "rgba(60,30,20,0.75)";
  c.font = `600 ${14 * u}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.fillText(`TEST PICTURE ${width} × ${height}`, 150 * u, 40 * u);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"));
}

export function PhotoDemo() {
  const store = useRef(new Map<string, PhotoInput>());
  const [photo, setPhoto] = useState<MainPhoto | undefined>();
  const [last, setLast] = useState<string>("");
  const [docPhoto, setDocPhoto] = useState<string | null>(null);

  function apply(change: PhotoChange) {
    if (change.put) store.current.set(change.put.id, change.put);
    if (change.delete) store.current.delete(change.delete);
    setPhoto(change.photo);
    setLast(JSON.stringify({ photo: change.photo, put: change.put && { id: change.put.id, width: change.put.width, height: change.put.height, bytes: change.put.blob.size }, delete: change.delete }, null, 2));
  }

  async function seed(width: number, height: number) {
    const blob = await drawTestPicture(width, height);
    const result = await preparePhoto(new File([blob], "test-picture.png", { type: "image/png" }));
    if (!result.ok) return;
    const id = crypto.randomUUID();
    apply({ photo: { id, crop: clampCrop(DEFAULT_CROP, result.photo.width, result.photo.height, photo?.frame ?? "3:4"), frame: photo?.frame ?? "3:4" }, put: { id, ...result.photo }, delete: photo?.id });
  }

  // What the document would get: the crop drawn at 300 dpi for the frame's printed width (renderCrop).
  useEffect(() => {
    const stored = photo && store.current.get(photo.id);
    if (!photo || !stored) return;
    let live = true;
    renderCropDataUrl(stored.blob, photo.crop, photo.frame, printPixels(PRINT_WIDTH_MM[photo.frame])).then((url) => live && setDocPhoto(url));
    return () => {
      live = false;
    };
  }, [photo]);

  const docWidth = photo?.frame === "2:3" ? 186 : 200;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className={`${pageWidth} flex h-14 items-center`}>
          <Logo />
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className={`${pageWidth} py-8 sm:py-10`}>
        <PageHeader
          title="Photo"
          description="The editor's photo card and cropper, with in-memory storage. Development only."
          actions={
            <>
              <button type="button" className={button("secondary", "sm")} onClick={() => void seed(2400, 3200)}>
                Use a drawn photo
              </button>
              <button type="button" className={button("secondary", "sm")} onClick={() => void seed(240, 320)}>
                Use a tiny photo
              </button>
            </>
          }
        />

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start">
          <section aria-labelledby="photo-card" className={card}>
            <div className={cardHeader}>
              <h2 id="photo-card" className={cardTitle}>
                Photo
              </h2>
              <span className={cardText}>Printed beside your details</span>
            </div>
            <PhotoField photo={photo} loadBlob={async (id) => store.current.get(id)?.blob} onChange={apply} />
          </section>

          <section className={`${card} p-4 sm:p-5`}>
            <h2 className={cardTitle}>What the document gets</h2>
            <p className={`${cardText} mt-1`}>renderCropDataUrl at 300 dpi for the frame&apos;s printed width, shown at its true size on the page.</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0 rounded-lg bg-[#fffaf0] p-3 ring-1 ring-line" style={{ width: docWidth + 24 }}>
                {photo && docPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local data URL
                  <img src={docPhoto} alt="" data-testid="doc-photo" style={{ width: docWidth, borderRadius: 10, display: "block" }} />
                ) : (
                  <div className="flex items-center justify-center rounded-[10px] border border-dashed border-stone-300 text-[13px] text-stone-500" style={{ width: docWidth, height: (docWidth * 4) / 3 }}>
                    No photo
                  </div>
                )}
              </div>
              <pre data-testid="photo-state" className="min-w-0 flex-1 overflow-auto rounded-lg bg-sunken p-3 text-xs leading-relaxed text-ink-2">
                {last || "No change yet"}
              </pre>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
