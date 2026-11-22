import { labelTables, type DocDictionary } from "@/i18n/doc";
import type { BiodataProfile, HoroscopeChart, PhotoFrame, PhotoPages, PhotoRef } from "./types";

// What the photo pages print (Step 4.2b, VISION D40, D41), decided from the profile alone so the editor, the
// document and the tests agree. Pure.

export type PerPage = PhotoPages["perPage"];

/**
 * The frame shape every photo on a photo page is cropped to, by layout (a decision of Step 4.2b, from the two frames
 * the designs already have): one photo to a page and two side by side are tall 2:3 (the largest portrait an A4 page's
 * width and height allow; full-length photos fit); four in a 2 × 2 grid are 3:4. It depends only on the layout, never
 * on the design, so changing the design never moves a crop.
 */
export const PHOTO_PAGE_FRAME: Record<PerPage, PhotoFrame> = { 1: "2:3", 2: "2:3", 4: "3:4" };

/** The photos printed on the pages after the biodata: none when the pages are switched off or there are no photos. */
export function printedPhotoPages(profile: Pick<BiodataProfile, "photoPages">): { perPage: PerPage; photos: PhotoRef[] } | undefined {
  const group = profile.photoPages;
  if (!group || group.include === false || group.photos.length === 0) return undefined;
  return { perPage: group.perPage, photos: group.photos };
}

/** The horoscope chart when it prints (not switched off). */
export function printedChart(profile: Pick<BiodataProfile, "horoscopeChart">): HoroscopeChart | undefined {
  const chart = profile.horoscopeChart;
  return chart && chart.include !== false ? chart : undefined;
}

/** How many pages `count` photos take at `perPage` to a page. */
export function photoPageCount(perPage: number, count: number): number {
  return count <= 0 ? 0 : Math.ceil(count / perPage);
}

/** The photos split into pages of `perPage`, in order. */
export function photoPageGroups<T>(photos: readonly T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < photos.length; i += perPage) pages.push(photos.slice(i, i + perPage));
  return pages;
}

/** The pages added after the biodata's own: photo pages, then the horoscope chart's page. */
export function extraPageCounts(profile: Pick<BiodataProfile, "photoPages" | "horoscopeChart">): { photos: number; chart: number; total: number } {
  const printed = printedPhotoPages(profile);
  const photos = printed ? photoPageCount(printed.perPage, printed.photos.length) : 0;
  const chart = printedChart(profile) ? 1 : 0;
  return { photos, chart, total: photos + chart };
}

/** The heading of the horoscope chart's page: the dictionary's Horoscope section title, in the document language. */
export function chartTitle(profile: Pick<BiodataProfile, "docLanguage" | "options">, dict: DocDictionary): string {
  const tables = labelTables(dict, profile.docLanguage, profile.options.labelStyle);
  return tables.sections.horoscope || dict.sections.horoscope;
}
