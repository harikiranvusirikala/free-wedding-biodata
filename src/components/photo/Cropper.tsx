"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { FRAME_ASPECT, MAX_ZOOM, MIN_ZOOM, PRINT_WIDTH_MM, DEFAULT_CROP, clampCrop, cropPlacement, effectiveDpi, LOW_DPI, panCrop, rotateCrop, zoomCrop } from "@/biodata/photo-crop";
import type { PhotoCrop, PhotoFrame } from "@/biodata/types";
import { Dialog } from "@/components/ui/Dialog";
import { button, iconButton } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { CropImage, type LoadedPhoto } from "./CropImage";
import { PhotoIcon } from "./icons";

// The photo cropper (VISION §10, D12, D40): our own, no library. Drag to move, pinch or scroll to zoom, a zoom
// slider, a quarter turn, the keyboard (arrows move, + and − zoom), Reset; the frame shows at 3:4 or 2:3 with the
// rest of the photo dimmed around it. While a finger moves, only the image's CSS transform changes, once per
// animation frame; React hears about the crop when the gesture ends, so it stays smooth on a phone.

/** Space around the frame inside the stage, so the dimmed photo around it shows what can be brought in. */
const STAGE_PAD = 20;
const KEY_STEP = 12;
const KEY_ZOOM = 1.1;

/** The frame inside the stage: as big as the stage allows, less its padding, at the frame's shape, centred. */
function frameBox(stageSize: { width: number; height: number }, aspect: number) {
  const width = Math.max(40, Math.min(stageSize.width - STAGE_PAD * 2, (stageSize.height - STAGE_PAD * 2) * aspect));
  const height = width / aspect;
  return { width, height, left: (stageSize.width - width) / 2, top: (stageSize.height - height) / 2 };
}

export function Cropper(props: {
  open: boolean;
  photo: LoadedPhoto;
  crop: PhotoCrop;
  frame: PhotoFrame;
  printWidthMm?: number;
  onCancel: () => void;
  onDone: (crop: PhotoCrop) => void;
}) {
  const { open, onCancel } = props;
  return (
    <Dialog open={open} onClose={onCancel} title={t("photo.cropper.title")} description={t("photo.cropper.description")} wide>
      <CropperBody {...props} />
    </Dialog>
  );
}

function CropperBody({ photo, crop: initial, frame, printWidthMm = PRINT_WIDTH_MM[frame], onCancel, onDone }: Parameters<typeof Cropper>[0]) {
  const { width, height } = photo;
  const clampTo = useCallback((next: PhotoCrop) => clampCrop(next, width, height, frame), [width, height, frame]);

  const [crop, setCrop] = useState(() => clampTo(initial));
  const cropRef = useRef(crop);
  const stage = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const frameRequest = useRef(0);
  const commitTimer = useRef(0);

  const box = stageSize ? frameBox(stageSize, FRAME_ASPECT[frame]) : null;
  /** The frame's place now, for gesture handlers (the stage's size is read straight from it). */
  const currentBox = useCallback(() => (stage.current ? frameBox({ width: stage.current.clientWidth, height: stage.current.clientHeight }, FRAME_ASPECT[frame]) : null), [frame]);

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    // Zero until the dialog has opened (its layout effect runs after this one); the observer then reports it.
    const measure = () => {
      if (element.clientWidth && element.clientHeight) setStageSize({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Writes the current crop to the image's transform (no React render). */
  const paint = useCallback(() => {
    frameRequest.current = 0;
    const b = currentBox();
    if (!b || !image.current) return;
    image.current.style.transform = cropPlacement(width, height, cropRef.current, frame, b.width).transform;
  }, [width, height, frame, currentBox]);

  const schedule = useCallback(() => {
    if (!frameRequest.current) frameRequest.current = requestAnimationFrame(paint);
  }, [paint]);

  /** A new crop: painted at once, and handed to React (slider, warning) now or when the gesture ends. */
  const update = useCallback(
    (next: PhotoCrop, commit: "now" | "later" | "soon") => {
      cropRef.current = next;
      schedule();
      window.clearTimeout(commitTimer.current);
      if (commit === "now") setCrop(next);
      else if (commit === "soon") commitTimer.current = window.setTimeout(() => setCrop(cropRef.current), 120);
    },
    [schedule],
  );

  useLayoutEffect(paint, [paint, box?.width, crop]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frameRequest.current);
      window.clearTimeout(commitTimer.current);
    },
    [],
  );

  /** A point on screen as an offset from the frame's centre, in fractions of the frame (for zooming around it). */
  const focusAt = useCallback((clientX: number, clientY: number) => {
    const b = currentBox();
    const rect = stage.current?.getBoundingClientRect();
    if (!b || !rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - b.left - b.width / 2) / b.width, y: (clientY - rect.top - b.top - b.height / 2) / b.height };
  }, [currentBox]);

  // Scrolling zooms around the pointer (a listener that may cancel the page's scroll, which React's can't).
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const current = cropRef.current;
      update(zoomCrop(current, current.zoom * Math.exp(-delta * 0.0015), width, height, frame, focusAt(event.clientX, event.clientY)), "soon");
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [focusAt, update, width, height, frame]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const before = map.get(event.pointerId);
    const b = currentBox();
    if (!before || !b) return;
    const previous = [...map.values()];
    map.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = [...map.values()];
    let next = cropRef.current;
    if (now.length === 1) {
      next = panCrop(next, event.clientX - before.x, event.clientY - before.y, width, height, frame, b.width);
    } else {
      // Two fingers: zoom by how much they spread around their old middle, then follow the middle.
      const [p0, p1] = previous;
      const [n0, n1] = now;
      const spread = Math.hypot(n1.x - n0.x, n1.y - n0.y) / Math.max(1, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const middle = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const nextMiddle = { x: (n0.x + n1.x) / 2, y: (n0.y + n1.y) / 2 };
      next = zoomCrop(next, next.zoom * spread, width, height, frame, focusAt(middle.x, middle.y));
      next = panCrop(next, nextMiddle.x - middle.x, nextMiddle.y - middle.y, width, height, frame, b.width);
    }
    update(next, "later");
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pointers.current.size === 0) setCrop(cropRef.current);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const b = currentBox();
    if (!b) return;
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const current = cropRef.current;
    let next: PhotoCrop | null = null;
    if (moves[event.key]) next = panCrop(current, ...moves[event.key], width, height, frame, b.width);
    else if (event.key === "+" || event.key === "=") next = zoomCrop(current, current.zoom * KEY_ZOOM, width, height, frame);
    else if (event.key === "-" || event.key === "_") next = zoomCrop(current, current.zoom / KEY_ZOOM, width, height, frame);
    if (!next) return;
    event.preventDefault();
    update(next, "now");
  }

  const dpi = Math.round(effectiveDpi(width, height, crop, frame, printWidthMm));
  const zoomBy = (factor: number) => update(zoomCrop(cropRef.current, cropRef.current.zoom * factor, width, height, frame), "now");

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={stage}
        role="group"
        tabIndex={0}
        data-autofocus
        aria-label={t("photo.cropper.area")}
        data-testid="crop-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        className="relative h-[clamp(14rem,calc(90dvh-23rem),30rem)] cursor-grab touch-none overflow-hidden rounded-xl bg-stone-900 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
      >
        {box && (
          <div className="pointer-events-none absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            <CropImage photo={photo} crop={crop} frame={frame} boxWidth={box.width} imageRef={image} transform={false} />
            {/* Dims everything outside the frame; the frame's edge and a rule-of-thirds guide sit on top. */}
            <div className="absolute inset-0 rounded-md shadow-[0_0_0_100vmax_rgb(12_10_9/0.62)] ring-1 ring-white/85" />
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border-white/20 not-nth-[3n]:border-r not-nth-[n+7]:border-b" />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button type="button" className={iconButton} aria-label={t("photo.cropper.zoomOut")} onClick={() => zoomBy(1 / KEY_ZOOM)} disabled={crop.zoom <= MIN_ZOOM}>
            <PhotoIcon name="zoomOut" className="size-5" />
          </button>
          <input
            type="range"
            aria-label={t("photo.cropper.zoom")}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => update(zoomCrop(cropRef.current, Number(event.target.value), width, height, frame), "now")}
            className="h-9 min-w-0 flex-1 cursor-pointer rounded-md accent-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:h-11"
          />
          <button type="button" className={iconButton} aria-label={t("photo.cropper.zoomIn")} onClick={() => zoomBy(KEY_ZOOM)} disabled={crop.zoom >= MAX_ZOOM}>
            <PhotoIcon name="zoomIn" className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className={button("secondary")} onClick={() => update(rotateCrop(cropRef.current, width, height, frame), "now")}>
            <PhotoIcon name="rotate" className="size-4" />
            {t("photo.cropper.rotate")}
          </button>
          <button type="button" className={button("ghost")} onClick={() => update(clampTo(DEFAULT_CROP), "now")}>
            <PhotoIcon name="reset" className="size-4" />
            {t("photo.cropper.reset")}
          </button>
        </div>
      </div>

      {dpi < LOW_DPI && (
        <p role="status" className="-mt-1 flex items-start gap-2 text-[13px] text-warn">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
          {t("photo.cropper.lowRes", { dpi })}
        </p>
      )}

      {/* Side by side even on phones (not the kit's stacked DialogActions), so the stage can be taller. */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" className={button("secondary")} onClick={onCancel}>
          {t("ui.cancel")}
        </button>
        <button type="button" className={button("primary")} onClick={() => onDone(cropRef.current)}>
          {t("photo.cropper.done")}
        </button>
      </div>
    </div>
  );
}
