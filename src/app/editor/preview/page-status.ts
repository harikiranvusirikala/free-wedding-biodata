import { t } from "@/lib/i18n";
import type { LayoutInfo } from "./PreviewControls";

/**
 * The count under the pages: "Fits on 1 page · A4", "2 pages · A4", or with pages after the biodata "1 page of details
 * + 3 photo pages + horoscope page · A4" (Step 4.2b).
 */
export function pageStatus(layout: Pick<LayoutInfo, "pages" | "photoPages" | "chartPages">): string {
  const { pages, photoPages, chartPages } = layout;
  if (!photoPages && !chartPages) return pages <= 1 ? t("preview.status.one") : t("preview.status.many", { pages });
  const parts = [pages <= 1 ? t("preview.status.detailsOne") : t("preview.status.detailsMany", { pages })];
  if (photoPages) parts.push(photoPages === 1 ? t("preview.status.photosOne") : t("preview.status.photosMany", { pages: photoPages }));
  if (chartPages) parts.push(t("preview.status.chart"));
  return t("preview.status.with", { parts: parts.join(" + ") });
}
