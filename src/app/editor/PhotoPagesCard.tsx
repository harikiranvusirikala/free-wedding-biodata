"use client";

import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { DEFAULT_CROP, sameCrop } from "@/biodata/photo-crop";
import { PHOTO_PAGE_FRAME, photoPageCount } from "@/biodata/photo-pages";
import {
  addPhotoPagePhoto,
  insertPhotoPagePhoto,
  movePhotoPagePhoto,
  removePhotoPagePhoto,
  replacePhotoPagePhoto,
  setHoroscopeChart,
  setHoroscopeIncluded,
  setPhotoPagesIncluded,
  setPhotosPerPage,
} from "@/biodata/edits";
import { MAX_EXTRA_PHOTOS, PHOTOS_PER_PAGE, type BiodataProfile, type HoroscopeChart, type PhotoCrop, type PhotoPages, type PhotoRef } from "@/biodata/types";
import { PHOTO_ERRORS, toLoaded } from "@/components/photo/PhotoField";
import type { LoadedPhoto } from "@/components/photo/CropImage";
import { Cropper } from "@/components/photo/Cropper";
import { PhotoIcon } from "@/components/photo/icons";
import { Switch } from "@/components/ui/Switch";
import { button, focusRing, iconButton } from "@/components/ui/button";
import { accentCard, accentTile, cardTitle } from "@/components/ui/card";
import { formError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { photoCellSize, photoPageCells, REFERENCE_CONTENT } from "@/document/photo-pages";
import { PAGE } from "@/document/tokens";
import { t } from "@/lib/i18n";
import { PHOTO_ACCEPT, preparePhoto, type PhotoError } from "@/lib/photos";
import { cropKey, fitKey, resolvePicture, type PictureRequest } from "@/lib/picture-store";
import type { PhotoInput } from "@/lib/profile-repo";
import { usePictures } from "@/lib/use-pictures";
import { useManage } from "./ManageProvider";

// The "More photos" card (Step 4.2b, VISION D40, D41; Photo's sibling in the form): extra photos printed on pages
// after the biodata, 1, 2 or 4 to a page, and a photo or scan of the horoscope chart on its own page. Optional, and
// built for frequent swapping (families send new pictures with the biodata): a switch turns the pages off without
// losing a photo, and each photo can be cropped, replaced, moved earlier or later, or removed (with Undo).
// Like the Photo card it holds no storage: it gets the profile's references and a way to read a stored picture, and
// hands every change to the editor as { edit, put, delete }, which the editor writes in one transaction with the
// profile (autosave). Memoised on the references, so typing elsewhere never re-renders it.

export const PHOTO_PAGES_ID = "photoPages";

/** What the card hands the editor: a pure edit and the pictures to store or delete in the same save. */
export interface PhotoPagesChange {
  edit: (profile: BiodataProfile) => BiodataProfile;
  put?: PhotoInput[];
  delete?: string[];
}

const NO_PHOTOS: PhotoRef[] = [];

/** The thumbnails' drawn width in px (shown at most ~90 px wide, so sharp on a 2× screen). */
const THUMB_PX = 200;
const THUMB_QUALITY = 0.8;
/** The card's thumbnails are this wide in CSS px; the frame decides the height. */
const THUMB_WIDTH = 76;

/** The printed width in mm of the largest cell a layout gives a photo: for the cropper's low-resolution warning. */
const cellMm = (perPage: PhotoPages["perPage"]) => (photoCellSize(REFERENCE_CONTENT, perPage).width * 25.4) / 96;

function summaryText(count: number, hasChart: boolean, include: boolean): string {
  if (!count && !hasChart) return t("pages.card.none");
  const parts: string[] = [];
  if (count) parts.push(t("pages.card.count", { count, max: MAX_EXTRA_PHOTOS }));
  if (hasChart) parts.push(t("pages.card.chart"));
  if (count && !include) parts.push(t("pages.card.off"));
  return parts.join(" · ");
}

export const PhotoPagesCard = memo(function PhotoPagesCard({
  photoPages,
  chart,
  loadBlob,
  readPicture,
  onChange,
  readOnly,
}: {
  photoPages?: PhotoPages;
  chart?: HoroscopeChart;
  loadBlob: (id: string) => Promise<Blob | undefined>;
  /** The whole stored record of a picture (to put it back on Undo). */
  readPicture: (id: string) => Promise<PhotoInput | undefined>;
  onChange: (change: PhotoPagesChange) => void;
  readOnly: boolean;
}) {
  const { notify } = useManage();
  const photos = photoPages?.photos ?? NO_PHOTOS;
  const perPage = photoPages?.perPage ?? 1;
  const include = photoPages?.include !== false;
  const frame = PHOTO_PAGE_FRAME[perPage];
  const room = MAX_EXTRA_PHOTOS - photos.length;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ error: PhotoError; chart?: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cropping, setCropping] = useState<{ ref: PhotoRef; loaded: LoadedPhoto } | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const chartInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);

  // The full picture held for the cropper is an object URL: let it go when the cropper closes or the card goes.
  const croppingUrl = cropping?.loaded.url;
  useEffect(() => (croppingUrl ? () => URL.revokeObjectURL(croppingUrl) : undefined), [croppingUrl]);

  // Thumbnails: small drawings of each photo in the layout's frame, and the chart fitted (never cropped).
  const requests = useMemo<PictureRequest[]>(() => {
    const list: PictureRequest[] = photos.map((photo) => ({
      key: cropKey(photo.id, photo.crop, frame, THUMB_PX, THUMB_QUALITY),
      id: photo.id,
      spec: { kind: "crop", crop: photo.crop, frame, outWidth: THUMB_PX, quality: THUMB_QUALITY },
    }));
    if (chart) list.push({ key: fitKey(chart.id, chart.crop.rotation, THUMB_PX * 2), id: chart.id, spec: { kind: "fit", rotation: chart.crop.rotation, maxSide: THUMB_PX * 2 } });
    return list;
  }, [photos, frame, chart]);
  const pictures = usePictures(requests, loadBlob);
  const pictureFor = (id: string) => {
    const request = requests.find((r) => r.id === id);
    return request ? resolvePicture(pictures.snapshot, request) : undefined;
  };

  /** Reads picked files into stored pictures, as many as `limit` allows; the first problem is shown. */
  async function prepare(files: File[], limit: number) {
    setError(null);
    setNote(null);
    setBusy(true);
    const prepared: { id: string; input: PhotoInput }[] = [];
    let problem: PhotoError | null = null;
    for (const file of files.slice(0, limit)) {
      const result = await preparePhoto(file);
      if (!result.ok) {
        problem ??= result.error;
        continue;
      }
      const id = crypto.randomUUID();
      prepared.push({ id, input: { id, ...result.photo } });
    }
    setBusy(false);
    return { prepared, problem, dropped: Math.max(0, files.length - limit) };
  }

  async function openCrop(ref: PhotoRef, blob?: Blob) {
    try {
      const source = blob ?? (await loadBlob(ref.id));
      if (!source) return;
      setCropping({ ref, loaded: await toLoaded(ref.id, source) });
    } catch {
      setError({ error: "decode" });
    }
  }

  async function addPhotos(files: File[]) {
    if (!files.length || busy || readOnly || room <= 0) return;
    const { prepared, problem, dropped } = await prepare(files, room);
    if (problem) setError({ error: problem });
    if (dropped > 0) setNote(t("pages.tooMany", { room }));
    if (!prepared.length) return;
    for (const { id, input } of prepared) onChange({ edit: (p) => addPhotoPagePhoto(p, { id, crop: DEFAULT_CROP }), put: [input] });
    // One picture: straight on to placing it in its frame, as the Photo card does.
    if (prepared.length === 1 && files.length === 1) void openCrop({ id: prepared[0].id, crop: DEFAULT_CROP }, prepared[0].input.blob);
  }

  async function replacePhoto(oldId: string, file: File | undefined) {
    if (!file || busy || readOnly) return;
    const { prepared, problem } = await prepare([file], 1);
    if (problem) setError({ error: problem });
    if (!prepared.length) return;
    const { id, input } = prepared[0];
    onChange({ edit: (p) => replacePhotoPagePhoto(p, oldId, { id, crop: DEFAULT_CROP }), put: [input], delete: [oldId] });
    void openCrop({ id, crop: DEFAULT_CROP }, input.blob);
  }

  function finishCrop(crop: PhotoCrop) {
    const target = cropping?.ref;
    setCropping(null);
    if (!target) return;
    const current = photos.find((p) => p.id === target.id);
    if (current && !sameCrop(crop, current.crop)) onChange({ edit: (p) => replacePhotoPagePhoto(p, target.id, { id: target.id, crop }) });
  }

  async function removePhoto(index: number) {
    const photo = photos[index];
    if (!photo) return;
    const record = await readPicture(photo.id);
    const settings = photoPages && { perPage: photoPages.perPage, include: photoPages.include };
    onChange({ edit: (p) => removePhotoPagePhoto(p, photo.id), delete: [photo.id] });
    notify(t("pages.removed", { n: index + 1 }), () => {
      onChange({ edit: (p) => insertPhotoPagePhoto(p, index, photo, settings), put: record ? [record] : undefined });
      notify(t("pages.back", { n: index + 1 }));
    });
  }

  async function setChartPicture(file: File | undefined) {
    if (!file || busy || readOnly) return;
    const { prepared, problem } = await prepare([file], 1);
    if (problem) setError({ error: problem, chart: true });
    if (!prepared.length) return;
    const { id, input } = prepared[0];
    const old = chart?.id;
    onChange({ edit: (p) => setHoroscopeChart(p, { id, crop: DEFAULT_CROP }), put: [input], delete: old ? [old] : undefined });
  }

  async function removeChart() {
    if (!chart) return;
    const removed = chart;
    const record = await readPicture(removed.id);
    onChange({ edit: (p) => setHoroscopeChart(p, undefined), delete: [removed.id] });
    notify(t("pages.chart.removed"), () => {
      onChange({ edit: (p) => setHoroscopeChart(p, removed), put: record ? [record] : undefined });
      notify(t("pages.chart.back"));
    });
  }

  function turnChart() {
    if (!chart) return;
    const rotation = ((chart.crop.rotation + 90) % 360) as PhotoCrop["rotation"];
    onChange({ edit: (p) => setHoroscopeChart(p, { id: chart.id, crop: { ...chart.crop, rotation } }) });
  }

  const titleId = `section-${PHOTO_PAGES_ID}-title`;
  const hasAny = photos.length > 0 || !!chart;
  const pageCount = photoPageCount(perPage, photos.length);
  const chartPicture = chart ? pictureFor(chart.id) : undefined;

  return (
    <section id={`section-${PHOTO_PAGES_ID}`} aria-labelledby={titleId} data-section={PHOTO_PAGES_ID} className={`${accentCard} scroll-mt-20 max-lg:scroll-mt-[7.5rem]`}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] ${hasAny ? "bg-good-soft text-good" : accentTile}`}>
          <PhotoIcon name="gallery" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} tabIndex={-1} className={`${cardTitle} outline-none`}>
            {t("pages.card.title")}
          </h2>
          <p className="mt-0.5 text-[13px] text-pretty text-ink-3" data-testid="pages-summary">
            {summaryText(photos.length, !!chart, include)}
          </p>
        </div>
      </div>

      <input
        ref={addInput}
        type="file"
        multiple
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        data-testid="pages-input"
        onChange={(event) => {
          void addPhotos([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        data-testid="pages-replace-input"
        onChange={(event) => {
          const id = replacing.current;
          replacing.current = null;
          if (id) void replacePhoto(id, event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={chartInput}
        type="file"
        accept={PHOTO_ACCEPT}
        className="hidden"
        tabIndex={-1}
        data-testid="chart-input"
        onChange={(event) => {
          void setChartPicture(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="p-4 sm:p-5">
        {photos.length === 0 ? (
          <div className="flex gap-4 sm:gap-5">
            <div aria-hidden className="flex h-24 w-[4.5rem] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed border-line-strong bg-sunken text-ink-3 sm:h-[7.5rem] sm:w-24">
              <PhotoIcon name="gallery" className="size-9" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("pages.intro.title")}</h3>
              <p className="mt-1 text-sm text-pretty text-ink-3">{t("pages.intro.text")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button type="button" className={button("primary")} onClick={() => addInput.current?.click()} disabled={busy || readOnly}>
                  {busy ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-on-brand border-t-transparent motion-reduce:animate-none" /> : <PhotoIcon name="camera" className="size-4" />}
                  {busy ? t("pages.preparing") : t("pages.add")}
                </button>
                <p className="text-[13px] text-pretty text-ink-3">{t("pages.formats")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Switch
              label={t("pages.include.label")}
              hint={t("pages.include.hint")}
              checked={include}
              disabled={readOnly}
              onChange={(next) => onChange({ edit: (p) => setPhotoPagesIncluded(p, next) })}
            />
            {!include && (
              <p role="status" data-testid="pages-off-note" className="rounded-xl border border-gold/25 bg-gold-soft px-3.5 py-2.5 text-[13px] text-pretty text-ink-2">
                {t("pages.off.note")}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm font-medium text-ink" data-testid="pages-counter" aria-live="polite">
                {t("pages.counter", { count: photos.length, max: MAX_EXTRA_PHOTOS })}
              </p>
              <button type="button" className={button("secondary", "sm")} onClick={() => addInput.current?.click()} disabled={busy || readOnly || room <= 0}>
                {busy ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" /> : <Icon name="plus" className="size-4" />}
                {busy ? t("pages.preparing") : t("pages.addMore")}
              </button>
            </div>
            {room <= 0 && (
              <p role="status" className="-mt-2 text-[13px] text-pretty text-ink-3" data-testid="pages-full">
                {t("pages.full", { max: MAX_EXTRA_PHOTOS })}
              </p>
            )}

            <div className="@container">
              <ul className={`grid gap-3 @[40rem]:grid-cols-2 ${include ? "" : "opacity-70"}`} data-testid="pages-grid">
                {photos.map((photo, index) => {
                  const picture = pictureFor(photo.id);
                  return (
                    <li key={photo.id} className="flex gap-3 rounded-xl border border-line bg-sunken/50 p-2.5" data-testid="pages-tile" data-photo-id={photo.id}>
                      <button
                        type="button"
                        onClick={() => void openCrop(photo)}
                        disabled={readOnly || picture === null}
                        aria-label={t("pages.crop", { n: index + 1 })}
                        className={`relative shrink-0 self-start overflow-hidden rounded-lg bg-sunken shadow-card ring-1 ring-line disabled:cursor-default ${focusRing}`}
                        style={{ width: THUMB_WIDTH, aspectRatio: frame === "2:3" ? "2 / 3" : "3 / 4" }}
                        data-testid="pages-thumb"
                      >
                        {picture ? (
                          // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, drawn small
                          <img src={picture.src} alt={t("pages.alt", { n: index + 1 })} draggable={false} className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-ink-3">
                            {picture === null ? <Icon name="alert" className="size-5" /> : <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" />}
                          </span>
                        )}
                      </button>
                      <div className="flex min-w-0 flex-1 flex-wrap content-center items-center justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{t("pages.photo", { n: index + 1 })}</p>
                          {perPage > 1 && <p className="text-[12.5px] text-ink-3">{t("pages.page", { n: Math.floor(index / perPage) + 1 })}</p>}
                          {picture === null && <p className="mt-0.5 text-[12.5px] text-danger">{t("pages.missing")}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            className={`${button("secondary", "sm")} pointer-coarse:min-w-11`}
                            aria-label={t("pages.replaceLabel", { n: index + 1 })}
                            disabled={busy || readOnly}
                            onClick={() => {
                              replacing.current = photo.id;
                              replaceInput.current?.click();
                            }}
                          >
                            <PhotoIcon name="swap" className="size-4" />
                            {/* Words where there is room (a wide one-column list); just the icon on phones and in two columns. */}
                            <span className="@max-[26rem]:sr-only @[40rem]:sr-only">{t("pages.replace")}</span>
                          </button>
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={t("pages.earlier", { n: index + 1 })}
                            title={t("pages.earlier", { n: index + 1 })}
                            disabled={readOnly || index === 0}
                            onClick={() => onChange({ edit: (p) => movePhotoPagePhoto(p, photo.id, index - 1) })}
                          >
                            <Icon name="arrowUp" className="size-4" />
                          </button>
                          <button
                            type="button"
                            className={iconButton}
                            aria-label={t("pages.later", { n: index + 1 })}
                            title={t("pages.later", { n: index + 1 })}
                            disabled={readOnly || index === photos.length - 1}
                            onClick={() => onChange({ edit: (p) => movePhotoPagePhoto(p, photo.id, index + 1) })}
                          >
                            <Icon name="arrowDown" className="size-4" />
                          </button>
                          <button
                            type="button"
                            className={`${iconButton} text-danger hover:text-danger`}
                            aria-label={t("pages.removeLabel", { n: index + 1 })}
                            title={t("pages.removeLabel", { n: index + 1 })}
                            disabled={readOnly}
                            onClick={() => void removePhoto(index)}
                          >
                            <Icon name="trash" className="size-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2.5 border-t border-line pt-4">
              <p id="pages-perpage-label" className="text-sm font-medium text-ink">
                {t("pages.perPage.label")}
              </p>
              <LayoutChoice value={perPage} onChange={(next) => onChange({ edit: (p) => setPhotosPerPage(p, next) })} disabled={readOnly} />
              <p className="text-[13px] text-pretty text-ink-3" data-testid="pages-layout-hint">
                {t(perPage === 1 ? "pages.layout.one" : perPage === 2 ? "pages.layout.two" : "pages.layout.four")}{" "}
                {pageCount === 1 ? t("pages.layout.pagesOne") : t("pages.layout.pagesMany", { pages: pageCount })}
              </p>
            </div>
          </div>
        )}

        {error && !error.chart && (
          <p role="alert" className={`mt-4 ${formError}`}>
            {t(PHOTO_ERRORS[error.error])}
          </p>
        )}
        {note && (
          <p role="status" className="mt-3 text-[13px] text-pretty text-ink-3">
            {note}
          </p>
        )}
        {photos.length === 0 && busy && (
          <p role="status" className="sr-only">
            {t("pages.preparing")}
          </p>
        )}

        {/* The horoscope chart (D41): its own framed page, fitted whole. */}
        <div className="mt-5 border-t border-line pt-4" data-testid="chart-block">
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("pages.chart.title")}</h3>
          {!chart ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="min-w-0 flex-1 basis-56 text-sm text-pretty text-ink-3">{t("pages.chart.none")}</p>
              <button type="button" className={button("secondary", "sm")} onClick={() => chartInput.current?.click()} disabled={busy || readOnly}>
                <PhotoIcon name="chart" className="size-4" />
                {t("pages.chart.add")}
              </button>
            </div>
          ) : (
            <div className="mt-2.5 space-y-3">
              <div className="flex gap-3 rounded-xl border border-line bg-sunken/50 p-2.5">
                <div
                  className="flex shrink-0 items-center justify-center self-start overflow-hidden rounded-lg bg-sunken shadow-card ring-1 ring-line"
                  style={{ width: THUMB_WIDTH + 12, height: THUMB_WIDTH + 12 }}
                  data-testid="chart-thumb"
                >
                  {chartPicture ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, drawn small
                    <img src={chartPicture.src} alt={t("pages.chart.alt")} draggable={false} className="max-h-full max-w-full object-contain" />
                  ) : chartPicture === null ? (
                    <Icon name="alert" className="size-5 text-ink-3" />
                  ) : (
                    <span className="size-5 animate-spin rounded-full border-2 border-line-strong border-t-transparent motion-reduce:animate-none" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] text-pretty text-ink-3">{t("pages.chart.hint")}</p>
                    {chartPicture === null && <p className="mt-0.5 text-[12.5px] text-danger">{t("pages.chart.missing")}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className={button("secondary", "sm")} onClick={() => chartInput.current?.click()} disabled={busy || readOnly}>
                      <PhotoIcon name="swap" className="size-4" />
                      {t("pages.chart.replace")}
                    </button>
                    <button type="button" className={button("secondary", "sm")} onClick={turnChart} disabled={readOnly || !chartPicture}>
                      <PhotoIcon name="rotate" className="size-4" />
                      {t("pages.chart.rotate")}
                    </button>
                    <button type="button" className={button("dangerOutline", "sm")} onClick={() => void removeChart()} disabled={readOnly}>
                      <Icon name="trash" className="size-4" />
                      {t("pages.chart.remove")}
                    </button>
                  </div>
                </div>
              </div>
              <Switch
                label={t("pages.chart.include")}
                hint={t("pages.chart.includeHint")}
                checked={chart.include !== false}
                disabled={readOnly}
                onChange={(next) => onChange({ edit: (p) => setHoroscopeIncluded(p, next) })}
              />
            </div>
          )}
          {error?.chart && (
            <p role="alert" className={`mt-3 ${formError}`}>
              {t(PHOTO_ERRORS[error.error])}
            </p>
          )}
        </div>
      </div>

      {cropping && (
        <Cropper
          open
          photo={cropping.loaded}
          crop={photos.find((p) => p.id === cropping.ref.id)?.crop ?? cropping.ref.crop}
          frame={frame}
          printWidthMm={cellMm(perPage)}
          onCancel={() => setCropping(null)}
          onDone={finishCrop}
        />
      )}
    </section>
  );
});

const LAYOUT_LABEL = { 1: "pages.perPage.one", 2: "pages.perPage.two", 4: "pages.perPage.four" } as const;

/**
 * "Photos per page": three tiles, each with a small drawing of the page it makes (the real cell arithmetic, so the
 * drawing is what prints). A radio group like SegmentedControl: Tab reaches the chosen tile, arrows move and choose.
 */
function LayoutChoice({ value, onChange, disabled }: { value: PhotoPages["perPage"]; onChange: (value: PhotoPages["perPage"]) => void; disabled: boolean }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = PHOTOS_PER_PAGE.indexOf(value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const to = step !== undefined ? (at + step + PHOTOS_PER_PAGE.length) % PHOTOS_PER_PAGE.length : event.key === "Home" ? 0 : event.key === "End" ? PHOTOS_PER_PAGE.length - 1 : -1;
    if (to < 0) return;
    event.preventDefault();
    onChange(PHOTOS_PER_PAGE[to]);
    event.currentTarget.querySelector<HTMLElement>(`[data-value="${PHOTOS_PER_PAGE[to]}"]`)?.focus();
  }
  return (
    <div role="radiogroup" aria-labelledby="pages-perpage-label" onKeyDown={onKeyDown} className="grid max-w-md grid-cols-3 gap-2" data-testid="pages-layout">
      {PHOTOS_PER_PAGE.map((n) => {
        const selected = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={n}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(n)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-55 pointer-coarse:min-h-11 ${focusRing} ${
              selected ? "border-brand/50 bg-brand-soft text-brand-ink ring-1 ring-brand/30" : "border-line-strong bg-surface text-ink-2 hover:bg-sunken"
            }`}
          >
            <LayoutGlyph perPage={n} className="h-12 w-9" />
            {t(LAYOUT_LABEL[n])}
          </button>
        );
      })}
    </div>
  );
}

/** A page with `perPage` photos drawn from the same cell arithmetic the document uses (a full page of photos). */
function LayoutGlyph({ perPage, className }: { perPage: PhotoPages["perPage"]; className: string }) {
  // Drawn for a typical design (Classic Gold's margins), so two photos show side by side as they print there.
  const content = { width: PAGE.width - 128, height: PAGE.height - 176 };
  const cells = photoPageCells(content, perPage, perPage);
  return (
    <svg viewBox={`0 0 ${PAGE.width} ${PAGE.height}`} aria-hidden className={className}>
      <rect x="6" y="6" width={PAGE.width - 12} height={PAGE.height - 12} rx="22" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.55" strokeWidth="14" />
      {cells.map((cell, i) => (
        <rect key={i} x={64 + cell.x} y={88 + cell.y} width={cell.width} height={cell.height} rx="14" fill="currentColor" fillOpacity="0.55" />
      ))}
    </svg>
  );
}
