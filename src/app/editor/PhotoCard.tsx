"use client";

import { memo } from "react";
import type { MainPhoto, PhotoRef } from "@/biodata/types";
import { accentCard, accentTile, cardTitle } from "@/components/ui/card";
import { PhotoField, type PhotoChange } from "@/components/photo/PhotoField";
import { PhotoIcon } from "@/components/photo/icons";
import { t } from "@/lib/i18n";
import type { PhotoInput } from "@/lib/profile-repo";
import type { PhotoPagesChange } from "./PhotoPagesCard";
import { SecondPhoto } from "./SecondPhoto";

// The photo card (Step 3.1 in the editor, VISION §10, D12, D40; mockup: editor), right after the top of the
// biodata: the photo printed beside the details on page 1, with its frame shape and crop. PhotoField does the
// work; the editor writes each change with the profile in one transaction (autosave's photo puts and deletes).
// The optional second photo on page 1 (Step 4.4, D40) sits at the card's foot once there is a main photo (or a
// second photo to manage). Memoised on the photos, so typing elsewhere never re-renders it.

export const PHOTO_ID = "photo";

export const PhotoCard = memo(function PhotoCard({
  photo,
  secondPhoto,
  loadBlob,
  readPicture,
  onChange,
  onSecondChange,
  readOnly,
}: {
  photo?: MainPhoto;
  secondPhoto?: PhotoRef;
  loadBlob: (id: string) => Promise<Blob | undefined>;
  /** The whole stored record of a picture (to put the second photo back on Undo). */
  readPicture: (id: string) => Promise<PhotoInput | undefined>;
  onChange: (change: PhotoChange) => void;
  onSecondChange: (change: PhotoPagesChange) => void;
  readOnly: boolean;
}) {
  const titleId = `section-${PHOTO_ID}-title`;
  const frame = photo ? t(photo.frame === "2:3" ? "photo.frame.tall" : "photo.frame.portrait") : "";
  return (
    <section id={`section-${PHOTO_ID}`} aria-labelledby={titleId} data-section={PHOTO_ID} className={`${accentCard} scroll-mt-20 max-lg:scroll-mt-[7.5rem]`}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] ${photo ? "bg-good-soft text-good" : accentTile}`}>
          <PhotoIcon name="camera" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} tabIndex={-1} className={`${cardTitle} outline-none`}>
            {t("photo.card.title")}
          </h2>
          <p className="mt-0.5 text-[13px] text-pretty text-ink-3" data-testid="photo-summary">
            {photo ? t(secondPhoto ? "photo.card.setTwo" : "photo.card.set", { frame }) : t("photo.card.none")}
          </p>
        </div>
      </div>
      <PhotoField photo={photo} loadBlob={loadBlob} onChange={onChange} disabled={readOnly} />
      {photo || secondPhoto ? (
        <SecondPhoto photo={secondPhoto} hasMain={!!photo} loadBlob={loadBlob} readPicture={readPicture} onChange={onSecondChange} readOnly={readOnly} />
      ) : null}
    </section>
  );
});
