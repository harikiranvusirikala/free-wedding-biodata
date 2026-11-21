"use client";

import type { CSSProperties, Ref } from "react";
import { cropPlacement } from "@/biodata/photo-crop";
import type { PhotoCrop, PhotoFrame } from "@/biodata/types";

/** The stored picture and its natural size, as PhotoField and the cropper hold it. */
export interface LoadedPhoto {
  id: string;
  /** An object URL for the stored Blob (revoked by its owner). */
  url: string;
  width: number;
  height: number;
}

/**
 * The source image placed by a crop inside a frame `boxWidth` wide (its parent is that frame: positioned, and
 * clipping or not). Only a CSS transform changes when the crop does, so moving it is cheap on a phone.
 */
export function CropImage(props: { photo: LoadedPhoto; crop: PhotoCrop; frame: PhotoFrame; boxWidth: number; imageRef?: Ref<HTMLImageElement>; alt?: string; transform?: boolean }) {
  const { photo, crop, frame, boxWidth, imageRef, alt = "", transform = true } = props;
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: photo.width,
    height: photo.height,
    maxWidth: "none",
    transformOrigin: "0 0",
    // The cropper sets the transform itself on every animation frame; here it comes from the props.
    transform: transform ? cropPlacement(photo.width, photo.height, crop, frame, boxWidth).transform : undefined,
  };
  // eslint-disable-next-line @next/next/no-img-element -- a local object URL, placed by a transform
  return <img ref={imageRef} src={photo.url} alt={alt} width={photo.width} height={photo.height} draggable={false} style={style} />;
}
