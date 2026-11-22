"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setSecondPhoto } from "@/biodata/edits";
import { DEFAULT_CROP, sameCrop } from "@/biodata/photo-crop";
import type { PhotoCrop, PhotoRef } from "@/biodata/types";
import type { LoadedPhoto } from "@/components/photo/CropImage";
import { Cropper } from "@/components/photo/Cropper";
import { PHOTO_ERRORS, toLoaded } from "@/components/photo/PhotoField";
import { PhotoIcon } from "@/components/photo/icons";
import { button, focusRing } from "@/components/ui/button";
import { formError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { SECOND_PHOTO_FRAME } from "@/document/blocks/types";
import { t } from "@/lib/i18n";
import { PHOTO_ACCEPT, preparePhoto, type PhotoError } from "@/lib/photos";
import { cropKey, resolvePicture, type PictureRequest } from "@/lib/picture-store";
import type { PhotoInput } from "@/lib/profile-repo";
import { usePictures } from "@/lib/use-pictures";
import { useManage } from "./ManageProvider";
import type { PhotoPagesChange } from "./PhotoPagesCard";

// The second photo on page 1 (Step 4.4, VISION D40), at the foot of the Photo card: optional, meant for a full-length
// or family picture, always in the tall 2:3 frame and printed a little smaller than the main photo, beside the
// details (each design places it: Classic beside a later section, Modern low in the side panel, Minimal beside the
// main photo). Add, crop, change, remove with Undo; it prints only with a main photo, and says so when there is none.
// Like the More photos card it holds no storage: every change goes to the editor as { edit, put, delete }, written
// in one transaction with the profile.

/** Thumbnail: drawn 200 px wide, shown 76 px wide (sharp on a 2× screen). */
const THUMB_PX = 200;
const THUMB_WIDTH = 76;
/**
 * Its largest printed width in any design (Modern's side panel: 152 px ≈ 40 mm; Classic 149 px), for the cropper's
 * low-resolution warning.
 */
const PRINT_MM = 41;

export function SecondPhoto({
  photo,
  hasMain,
  loadBlob,
  readPicture,
  onChange,
  readOnly,
}: {
  photo?: PhotoRef;
  /** The second photo prints only with a main photo. */
  hasMain: boolean;
  loadBlob: (id: string) => Promise<Blob | undefined>;
  readPicture: (id: string) => Promise<PhotoInput | undefined>;
  onChange: (change: PhotoPagesChange) => void;
  readOnly: boolean;
}) {
  const { notify } = useManage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PhotoError | null>(null);
  const [cropping, setCropping] = useState<{ ref: PhotoRef; loaded: LoadedPhoto } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const croppingUrl = cropping?.loaded.url;
  useEffect(() => (croppingUrl ? () => URL.revokeObjectURL(croppingUrl) : undefined), [croppingUrl]);

  const requests = useMemo<PictureRequest[]>(
    () =>
      photo
        ? [{ key: cropKey(photo.id, photo.crop, SECOND_PHOTO_FRAME, THUMB_PX, 0.8), id: photo.id, spec: { kind: "crop", crop: photo.crop, frame: SECOND_PHOTO_FRAME, outWidth: THUMB_PX, quality: 0.8 } }]
        : [],
    [photo],
  );
  const pictures = usePictures(requests, loadBlob);
  const picture = requests[0] ? resolvePicture(pictures.snapshot, requests[0]) : undefined;

  async function openCrop(ref: PhotoRef, blob?: Blob) {
    try {
      const source = blob ?? (await loadBlob(ref.id));
      if (!source) return;
      setCropping({ ref, loaded: await toLoaded(ref.id, source) });
    } catch {
      setError("decode");
    }
  }

  async function pick(file: File | undefined) {
    if (!file || busy || readOnly) return;
    setError(null);
    setBusy(true);
    const result = await preparePhoto(file);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const id = crypto.randomUUID();
    const put: PhotoInput = { id, ...result.photo };
    const old = photo?.id;
    onChange({ edit: (p) => setSecondPhoto(p, { id, crop: DEFAULT_CROP }), put: [put], delete: old ? [old] : undefined });
    // Straight on to placing it in its frame, as the Photo card does.
    void openCrop({ id, crop: DEFAULT_CROP }, put.blob);
  }

  function finishCrop(crop: PhotoCrop) {
    const target = cropping?.ref;
    setCropping(null);
    if (target && photo?.id === target.id && !sameCrop(crop, photo.crop)) onChange({ edit: (p) => setSecondPhoto(p, { id: target.id, crop }) });
  }

  async function remove() {
    if (!photo) return;
    const removed = photo;
    const record = await readPicture(removed.id);
    onChange({ edit: (p) => setSecondPhoto(p, undefined), delete: [removed.id] });
    notify(t("second.removed"), () => {
      onChange({ edit: (p) => setSecondPhoto(p, removed), put: record ? [record] : undefined });
      notify(t("second.back"));
    });
  }

  return (
    <div className="border-t border-line px-4 py-4 sm:px-5" data-testid="second-photo">
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        data-testid="second-photo-input"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("second.title")}</h3>
      {!photo ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <p className="min-w-0 flex-1 basis-56 text-sm text-pretty text-ink-3">{t("second.none")}</p>
          <button type="button" className={button("secondary", "sm")} onClick={() => input.current?.click()} disabled={busy || readOnly}>
            {busy ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" /> : <Icon name="plus" className="size-4" />}
            {busy ? t("photo.preparing") : t("second.add")}
          </button>
        </div>
      ) : (
        <div className="mt-2.5 flex gap-3 rounded-xl border border-line bg-sunken/50 p-2.5">
          <button
            type="button"
            onClick={() => void openCrop(photo)}
            disabled={readOnly || picture === null || busy}
            aria-label={t("second.cropAction")}
            className={`relative shrink-0 self-start overflow-hidden rounded-lg bg-sunken shadow-card ring-1 ring-line disabled:cursor-default ${focusRing}`}
            style={{ width: THUMB_WIDTH, aspectRatio: "2 / 3" }}
            data-testid="second-photo-thumb"
            data-crop={JSON.stringify(photo.crop)}
          >
            {picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, drawn small
              <img src={picture.src} alt={t("second.alt")} draggable={false} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-3">
                {picture === null ? <Icon name="alert" className="size-5" /> : <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" />}
              </span>
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
            <div className="min-w-0 space-y-1">
              <p className="text-[13px] text-pretty text-ink-3">{t("second.hint")}</p>
              {!hasMain && (
                <p role="status" className="text-[13px] font-medium text-pretty text-warn" data-testid="second-photo-needs-main">
                  {t("second.needsMain")}
                </p>
              )}
              {picture === null && <p className="text-[12.5px] text-danger">{t("second.missing")}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={button("secondary", "sm")} onClick={() => void openCrop(photo)} disabled={readOnly || picture === null || busy}>
                <PhotoIcon name="crop" className="size-4" />
                {t("photo.crop")}
              </button>
              <button type="button" className={button("secondary", "sm")} onClick={() => input.current?.click()} disabled={busy || readOnly}>
                <PhotoIcon name="swap" className="size-4" />
                {busy ? t("photo.preparing") : t("photo.change")}
              </button>
              <button type="button" className={button("dangerOutline", "sm")} onClick={() => void remove()} disabled={readOnly || busy} aria-label={t("second.removeLabel")}>
                <Icon name="trash" className="size-4" />
                {t("photo.remove")}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className={`mt-3 ${formError}`}>
          {t(PHOTO_ERRORS[error])}
        </p>
      )}
      {cropping && (
        <Cropper
          open
          photo={cropping.loaded}
          crop={photo?.id === cropping.ref.id ? photo.crop : cropping.ref.crop}
          frame={SECOND_PHOTO_FRAME}
          printWidthMm={PRINT_MM}
          onCancel={() => setCropping(null)}
          onDone={finishCrop}
        />
      )}
    </div>
  );
}
