import type { PhotoInput } from "./types";

// The main photo (D12, D40): portrait 3:4, or tall 2:3 for a full-length photo, with soft corners. Drawn only
// when there is a picture: an absent photo leaves no frame in the document. The crop is applied by Step 3.1
// before the picture gets here; object-fit covers the frame either way.

/** Frame height for a width: 3:4 or 2:3. */
export const photoHeight = (frame: PhotoInput["frame"], width: number) => Math.round(frame === "2:3" ? width * 1.5 : (width * 4) / 3);

/**
 * The second photo on page 1 (Step 4.4, D40) prints a little smaller than the main one: a design's tall 2:3 width
 * times this, so it reads as the companion picture and its section's rows keep their room.
 */
export const SECOND_PHOTO_SCALE = 0.8;
export const secondPhotoWidth = (tallWidth: number) => Math.round(tallWidth * SECOND_PHOTO_SCALE);

export function Photo({ photo, width, radius }: { photo: PhotoInput; width: number; radius: number }) {
  const height = photoHeight(photo.frame, width);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local data/blob URL, drawn at true size
    <img src={photo.src} alt="" data-photo width={width} height={height} style={{ display: "block", width, height, objectFit: "cover", borderRadius: radius, flex: "none" }} />
  );
}
