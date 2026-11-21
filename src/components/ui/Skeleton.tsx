import { t } from "@/lib/i18n";

/** A soft grey block that pulses where something is loading; give it the final thing's size and corners. */
export const skeleton = "animate-pulse bg-line motion-reduce:animate-none";

/** One block, hidden from screen readers (the area around it says "Loading…" once, with LoadingNote). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`${skeleton} ${className}`} />;
}

/** The words screen readers hear while skeletons stand in. */
export function LoadingNote() {
  return <span className="sr-only">{t("ui.loading")}</span>;
}
