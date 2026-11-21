import { focusRing } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";

/**
 * The app icon (docs/brand/app-icon.svg, VISION D48) and the name, linking home. `compact` shows only the icon on
 * phones (the editor's header needs the room for the save status); the link keeps the name for screen readers.
 */
export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <a href={href} className={`flex shrink-0 items-center gap-2.5 rounded-lg font-bold pointer-coarse:min-h-11 tracking-tight whitespace-nowrap text-ink ${focusRing}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimiser */}
      <img src="/brand/app-icon.svg" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className={`text-[16.5px] ${compact ? "max-sm:sr-only" : ""}`}>{SITE_NAME}</span>
    </a>
  );
}
