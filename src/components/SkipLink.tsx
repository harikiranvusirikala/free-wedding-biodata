import { t } from "@/lib/i18n";

/** The first thing Tab reaches: jumps past the header to the page (WCAG 2.4.1). Hidden until focused. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:ring-[3px] focus:ring-ring focus:outline-none"
    >
      {t("ui.skipToContent")}
    </a>
  );
}
