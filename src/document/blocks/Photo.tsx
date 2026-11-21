import type { PhotoInput } from "./types";

// The main photo (D12, D40): portrait 3:4, or tall 2:3 for a full-length photo, with soft corners. Drawn only
// when there is a picture: an absent photo leaves no frame in the document. The crop is applied by Step 3.1
// before the picture gets here; object-fit covers the frame either way.

/** Frame height for a width: 3:4 or 2:3. */
export const photoHeight = (frame: PhotoInput["frame"], width: number) => Math.round(frame === "2:3" ? width * 1.5 : (width * 4) / 3);

export function Photo({ photo, width, radius }: { photo: PhotoInput; width: number; radius: number }) {
  const height = photoHeight(photo.frame, width);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local data/blob URL, drawn at true size
    <img src={photo.src} alt="" width={width} height={height} style={{ display: "block", width, height, objectFit: "cover", borderRadius: radius, flex: "none" }} />
  );
}
