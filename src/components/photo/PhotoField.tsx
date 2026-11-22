"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { DEFAULT_CROP, PRINT_WIDTH_MM, clampCrop, effectiveDpi, frameHeight, LOW_DPI, sameCrop } from "@/biodata/photo-crop";
import type { MainPhoto, PhotoCrop, PhotoFrame } from "@/biodata/types";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { button } from "@/components/ui/button";
import { formError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t, type AppKey } from "@/lib/i18n";
import { PHOTO_ACCEPT, preparePhoto, type PhotoError } from "@/lib/photos";
import type { PhotoInput } from "@/lib/profile-repo";
import { CropImage, type LoadedPhoto } from "./CropImage";
import { Cropper } from "./Cropper";
import { PhotoIcon, type PhotoIconName } from "./icons";

// The main photo's card content (VISION §10, D12, D40, D47): tips and Add photo when there is none; otherwise the
// picture in its frame with Crop, Change, Remove, the frame shape (3:4 or tall 2:3) and a warning when it would
// print blurry. It holds no storage of its own: the editor passes the profile's photo and a way to read a stored
// Blob, and gets every change back as { photo, put, delete }, which maps onto profile-repo's save() (one
// transaction for the profile and its photo, D9).

/** What PhotoField hands the editor. `photo` is the profile's new main photo (undefined: none). */
export interface PhotoChange {
  photo?: MainPhoto;
  /** A new picture to store under `put.id` with this save. */
  put?: PhotoInput;
  /** A stored picture this draft no longer uses. */
  delete?: string;
}

export interface PhotoFieldProps {
  photo?: MainPhoto;
  /** Reads a stored picture (profile-repo's getPhoto(id) → record.blob); undefined when it isn't there. */
  loadBlob: (id: string) => Promise<Blob | undefined>;
  onChange: (change: PhotoChange) => void;
  /** The template's printed frame width per shape, for the low-resolution warning (Classic Gold's by default). */
  printWidthMm?: Partial<Record<PhotoFrame, number>>;
  /** Read-only, like the rest of the form when another tab saved first. */
  disabled?: boolean;
}

/** The thumbnail's width in CSS pixels (3:4 → 128 × 171, 2:3 → 128 × 192). */
const THUMB_WIDTH = 128;

const TIPS: { key: AppKey; icon: PhotoIconName }[] = [
  { key: "photo.tip.light", icon: "sun" },
  { key: "photo.tip.background", icon: "frame" },
  { key: "photo.tip.recent", icon: "calendar" },
  { key: "photo.tip.face", icon: "face" },
];

/** The app string that explains each way picking a photo can fail. */
export const PHOTO_ERRORS: Record<PhotoError, AppKey> = {
  type: "photo.error.type",
  size: "photo.error.size",
  empty: "photo.error.empty",
  heic: "photo.error.heic",
  decode: "photo.error.decode",
  memory: "photo.error.memory",
};

/** Reads a Blob into a picture the page can show, with its natural size. The caller owns (revokes) the URL. */
export async function toLoaded(id: string, blob: Blob): Promise<LoadedPhoto> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { id, url, width: image.naturalWidth, height: image.naturalHeight };
}

export function PhotoField({ photo, loadBlob, onChange, printWidthMm, disabled = false }: PhotoFieldProps) {
  /** The stored picture last read for the profile's photo (missing when storage didn't have it). */
  const [stored, setStored] = useState<{ id: string; photo: LoadedPhoto | null } | null>(null);
  /** A picture just picked here, shown at once (before the editor has stored it). */
  const [fresh, setFresh] = useState<LoadedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PhotoError | null>(null);
  const [cropping, setCropping] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const loadRef = useRef(loadBlob);
  useEffect(() => {
    loadRef.current = loadBlob;
  });

  const id = photo?.id;
  const freshId = fresh?.id;

  // Read the profile's photo from storage, unless it is the one just picked here.
  useEffect(() => {
    if (!id || id === freshId) return;
    let live = true;
    loadRef
      .current(id)
      .then((blob) => (blob ? toLoaded(id, blob) : null))
      .catch(() => null)
      .then((loaded) => {
        if (live) setStored({ id, photo: loaded });
        else if (loaded) URL.revokeObjectURL(loaded.url);
      });
    return () => {
      live = false;
    };
  }, [id, freshId]);

  // An object URL lives as long as its picture is held (VISION §10: revoke temporary URLs).
  const freshUrl = fresh?.url;
  const storedUrl = stored?.photo?.url;
  useEffect(() => (freshUrl ? () => URL.revokeObjectURL(freshUrl) : undefined), [freshUrl]);
  useEffect(() => (storedUrl ? () => URL.revokeObjectURL(storedUrl) : undefined), [storedUrl]);

  const loaded = !id ? null : fresh?.id === id ? fresh : stored?.id === id ? stored.photo : null;
  const missing = !!id && !loaded && stored?.id === id;
  const frame: PhotoFrame = photo?.frame ?? "3:4";
  const printWidth = printWidthMm?.[frame] ?? PRINT_WIDTH_MM[frame];
  const dpi = loaded && photo ? Math.round(effectiveDpi(loaded.width, loaded.height, photo.crop, frame, printWidth)) : null;

  async function pick(file: File | undefined) {
    if (!file || busy || disabled) return;
    setError(null);
    setBusy(true);
    const result = await preparePhoto(file);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    const newId = crypto.randomUUID();
    let next: LoadedPhoto;
    try {
      next = await toLoaded(newId, result.photo.blob);
    } catch {
      setBusy(false);
      setError("memory");
      return;
    }
    setFresh(next);
    setBusy(false);
    onChange({
      photo: { id: newId, crop: clampCrop(DEFAULT_CROP, next.width, next.height, frame), frame },
      put: { id: newId, ...result.photo },
      delete: photo?.id,
    });
    setCropping(true); // straight on to placing it in the frame
  }

  function choose() {
    input.current?.click();
  }

  function setFrame(nextFrame: PhotoFrame) {
    if (!photo || nextFrame === photo.frame) return;
    const crop = loaded ? clampCrop(photo.crop, loaded.width, loaded.height, nextFrame) : photo.crop;
    onChange({ photo: { ...photo, frame: nextFrame, crop } });
  }

  function finishCrop(crop: PhotoCrop) {
    setCropping(false);
    if (photo && !sameCrop(crop, photo.crop)) onChange({ photo: { ...photo, crop } });
  }

  function remove() {
    setConfirmRemove(false);
    setError(null);
    if (photo) onChange({ photo: undefined, delete: photo.id });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  }

  const thumbHeight = frameHeight(frame, THUMB_WIDTH);

  return (
    <div
      className={`relative p-4 transition-shadow sm:p-5 ${dragging ? "rounded-2xl ring-2 ring-brand ring-inset" : ""}`}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      data-testid="photo-field"
    >
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        data-testid="photo-input"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = ""; // so picking the same file again still counts
        }}
      />

      {!photo ? (
        <div className="flex gap-4 sm:gap-5">
          <div aria-hidden className="flex h-32 w-24 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed border-line-strong bg-sunken text-ink-3 sm:h-[9.5rem] sm:w-28">
            <PhotoIcon name="person" className="size-10" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("photo.empty.title")}</h3>
            <p className="mt-1 text-sm text-pretty text-ink-3">{t("photo.empty.text")}</p>
            <ul className="mt-3 grid gap-x-5 gap-y-1.5 text-[13px] text-ink-2 sm:grid-cols-2">
              {TIPS.map((tip) => (
                <li key={tip.key} className="flex items-start gap-2">
                  <PhotoIcon name={tip.icon} className="mt-px size-4 text-gold" />
                  <span className="min-w-0 text-pretty">{t(tip.key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        // Phones: the picture with its three buttons beside it, the frame choice below; wider: the frame choice
        // beside the picture with the buttons under it.
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:grid-rows-[auto_1fr] sm:gap-x-5">
          <button
            type="button"
            onClick={() => setCropping(true)}
            disabled={!loaded || disabled}
            aria-label={t("photo.cropAction")}
            className="relative shrink-0 self-start overflow-hidden rounded-xl bg-sunken shadow-card ring-1 ring-line outline-none sm:row-span-2 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default"
            style={{ width: THUMB_WIDTH, height: thumbHeight }}
            data-testid="photo-thumb"
            data-crop={loaded ? JSON.stringify(photo.crop) : undefined}
            data-frame={frame}
          >
            {loaded ? (
              <CropImage photo={loaded} crop={photo.crop} frame={frame} boxWidth={THUMB_WIDTH} alt={t("photo.alt")} />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-3">
                {missing ? <Icon name="alert" className="size-6" /> : <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" />}
              </span>
            )}
          </button>

          <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <span aria-hidden className="text-sm font-medium text-ink">
              {t("photo.frame.label")}
            </span>
            <SegmentedControl
              label={t("photo.frame.label")}
              value={frame}
              options={[
                { value: "3:4", label: t("photo.frame.portrait"), disabled },
                { value: "2:3", label: t("photo.frame.tall"), disabled },
              ]}
              onChange={setFrame}
              className="w-full sm:max-w-xs"
            />
            <span className="text-[13px] text-pretty text-ink-3">{t("photo.frame.hint")}</span>
          </div>
          <div className="col-start-2 row-start-1 flex flex-col gap-2 sm:row-start-2 sm:flex-row sm:flex-wrap sm:self-start">
            <button type="button" className={button("secondary", "sm")} onClick={() => setCropping(true)} disabled={!loaded || disabled}>
              <PhotoIcon name="crop" className="size-4" />
              {t("photo.crop")}
            </button>
            <button type="button" className={button("secondary", "sm")} onClick={choose} disabled={busy || disabled}>
              <PhotoIcon name="swap" className="size-4" />
              {t("photo.change")}
            </button>
            <button type="button" className={button("dangerOutline", "sm")} onClick={() => setConfirmRemove(true)} disabled={disabled}>
              <Icon name="trash" className="size-4" />
              {t("photo.remove")}
            </button>
          </div>
        </div>
      )}

      {missing && (
        <p role="alert" className={`mt-4 ${formError}`}>
          {t("photo.missing")}
        </p>
      )}

      {dpi !== null && dpi < LOW_DPI && (
        <div role="status" data-testid="photo-low-res" className="mt-4 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-sm sm:px-4">
          <Icon name="alert" className="mt-0.5 size-[18px] text-warn" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{t("photo.lowRes.title")}</p>
            <p className="mt-0.5 text-pretty text-ink-2">{t("photo.lowRes.text", { dpi })}</p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className={`mt-4 ${formError}`}>
          {t(PHOTO_ERRORS[error])}
        </p>
      )}

      {(!photo || busy) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!photo && (
            <button type="button" className={button("primary")} onClick={choose} disabled={busy || disabled}>
              {busy ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-on-brand border-t-transparent motion-reduce:animate-none" /> : <PhotoIcon name="camera" className="size-4" />}
              {busy ? t("photo.preparing") : t("photo.add")}
            </button>
          )}
          {photo && busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-ink-3">
              <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" />
              {t("photo.preparing")}
            </p>
          )}
          {!photo && <p className="text-[13px] text-pretty text-ink-3">{t("photo.formats")}</p>}
        </div>
      )}

      {loaded && photo && (
        <Cropper open={cropping} photo={loaded} crop={photo.crop} frame={frame} printWidthMm={printWidth} onCancel={() => setCropping(false)} onDone={finishCrop} />
      )}

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title={t("photo.removeDialog.title")} description={t("photo.removeDialog.text")}>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={() => setConfirmRemove(false)}>
            {t("ui.cancel")}
          </button>
          <button type="button" className={button("danger")} onClick={remove}>
            {t("photo.removeDialog.confirm")}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
