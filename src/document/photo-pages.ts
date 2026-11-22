import { frameHeight } from "@/biodata/photo-crop";
import { PHOTO_PAGE_FRAME, photoPageCount, type PerPage } from "@/biodata/photo-pages";
import type { PagePicture, PhotoPagesInput } from "./blocks/types";
import { PAGE, type Box } from "./tokens";

// The layout of the pages after the biodata (Step 4.2b, VISION D40, D41), pure so every design, the preview, the
// PDF and the page images share one set of numbers (D1). All sizes are CSS px on the A4 page, the display list's
// space, and positions are relative to the page's content box (the design's margins for a page after the first).
//
// Photo pages: one photo is the largest tall 2:3 cell the content box holds; two sit side by side in 2:3 cells (stacked
// in a narrow box, where that makes them wider); four make a 2 × 2 grid of 3:4 cells (PHOTO_PAGE_FRAME). Every page of a document uses the same cell size, so a page
// with fewer photos than the layout holds (the last one) keeps the size its neighbours have; its photos are
// centred, row by row, with the block centred on the page. The chart page is a heading and the picture fitted
// (contain, never cropped) into what is left below it.

export interface Size {
  width: number;
  height: number;
}

export interface Cell extends Size {
  x: number;
  y: number;
}

/** Space between photos, in px. */
export const PHOTO_GAP = 24;

/** Space kept under the chart page's heading bar for the heading itself (bar, its underline and the gap below). */
export const CHART_HEADING_RESERVE = 72;

/** The content box of a page that is not the first (what a photo page uses). */
export function contentSize(box: Box): Size {
  return { width: PAGE.width - box.left - box.right, height: PAGE.height - box.top - box.bottom };
}

/**
 * The largest content box any design gives a page after the first (60 px side margins as Kalyanam has, 56 px top and
 * bottom as the Modern skeleton has; a test checks every design fits in it). A picture drawn for this box is never
 * scaled up by any design.
 */
export const REFERENCE_CONTENT: Size = { width: PAGE.width - 120, height: PAGE.height - 112 };

const ASPECT: Record<PerPage, number> = { 1: 2 / 3, 2: 2 / 3, 4: 3 / 4 };

/** How many photos a row holds and how many rows a full page has. */
export interface Grid {
  columns: number;
  rows: number;
  cell: Size;
}

function gridFor(content: Size, columns: number, rows: number, aspect: number, frame: PerPage): Grid {
  const widthFromColumns = (content.width - PHOTO_GAP * (columns - 1)) / columns;
  const heightFromRows = (content.height - PHOTO_GAP * (rows - 1)) / rows;
  const width = Math.floor(Math.min(widthFromColumns, heightFromRows * aspect));
  return { columns, rows, cell: { width, height: Math.floor(frameHeight(PHOTO_PAGE_FRAME[frame], width)) } };
}

/**
 * The grid of a full page: one photo is the largest cell the content box holds; four are a 2 × 2 grid; two sit side by
 * side, unless the box is so narrow (the Modern designs' column beside the side panel) that two stacked, one above the
 * other, get wider cells. The cell shape (PHOTO_PAGE_FRAME) is the same either way, so a crop never changes with the design.
 */
export function photoGrid(content: Size, perPage: PerPage): Grid {
  if (perPage === 1) return gridFor(content, 1, 1, ASPECT[1], 1);
  if (perPage === 4) return gridFor(content, 2, 2, ASPECT[4], 4);
  const side = gridFor(content, 2, 1, ASPECT[2], 2);
  const stacked = gridFor(content, 1, 2, ASPECT[2], 2);
  return stacked.cell.width > side.cell.width ? stacked : side;
}

/** The size of one photo's cell in a content box, the same for every page of the layout. */
export function photoCellSize(content: Size, perPage: PerPage): Size {
  return photoGrid(content, perPage).cell;
}

/**
 * Where the `count` photos of one page sit (1 ≤ count ≤ perPage): rows of the grid's width, each row centred across
 * the content box, the whole block centred down it.
 */
export function photoPageCells(content: Size, perPage: PerPage, count: number): Cell[] {
  const { columns, cell: size } = photoGrid(content, perPage);
  const shown = Math.max(1, Math.min(count, perPage));
  const rows = Math.ceil(shown / columns);
  const blockHeight = rows * size.height + (rows - 1) * PHOTO_GAP;
  const top = Math.round((content.height - blockHeight) / 2);
  const cells: Cell[] = [];
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, shown - row * columns);
    const rowWidth = inRow * size.width + (inRow - 1) * PHOTO_GAP;
    cells.push({
      x: Math.round((content.width - rowWidth) / 2) + (i % columns) * (size.width + PHOTO_GAP),
      y: top + row * (size.height + PHOTO_GAP),
      ...size,
    });
  }
  return cells;
}

/** The pixels across a photo's cell at 300 dpi in the largest content box: what a photo is drawn at (D40). */
export function photoPagePixels(perPage: PerPage, dpi = 300): number {
  return Math.ceil((photoCellSize(REFERENCE_CONTENT, perPage).width * dpi) / 96);
}

/** The chart picture fitted (contain) below the heading, as large as the space allows, centred across the page. */
export function chartPlacement(content: Size, picture: Pick<PagePicture, "width" | "height">): Cell {
  const area = { width: content.width, height: content.height - CHART_HEADING_RESERVE };
  const scale = Math.min(area.width / picture.width, area.height / picture.height);
  const width = Math.max(1, Math.floor(picture.width * scale));
  const height = Math.max(1, Math.floor(picture.height * scale));
  return { x: Math.round((area.width - width) / 2), y: CHART_HEADING_RESERVE, width, height };
}

/** How many pages the input adds after the biodata. */
export function inputPageCounts(input: PhotoPagesInput | undefined): { photos: number; chart: number; total: number } {
  const photos = input ? photoPageCount(input.perPage, input.photos.length) : 0;
  const chart = input?.chart ? 1 : 0;
  return { photos, chart, total: photos + chart };
}
