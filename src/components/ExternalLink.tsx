import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/**
 * A link to another site (Buy me a coffee, GitHub): a new tab, so the page here stays open, with
 * rel="noopener noreferrer" so that site can't reach back into this one or learn which page sent it.
 * Screen readers hear that it opens a new tab.
 */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> {t("ui.newTab")}</span>
    </a>
  );
}
