"use client";

import { usePathname } from "next/navigation";
import { focusRing } from "@/components/ui/button";
import { t, type AppKey } from "@/lib/i18n";

/**
 * The public pages' navigation: only pages that exist (BUILD_PLAN Part B rule 4). Client-side only to mark the page
 * you're on.
 */
const LINKS: { href: string; label: AppKey }[] = [
  { href: "/templates", label: "nav.templates" },
  { href: "/guide", label: "nav.guide" },
  { href: "/help", label: "nav.help" },
  { href: "/privacy", label: "nav.privacy" },
];

export function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={t("nav.label")} className={className}>
      <ul className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <a
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex h-9 items-center rounded-lg px-3 text-[14.5px] font-medium transition-colors ${focusRing} ${current ? "text-ink" : "text-ink-3 hover:text-ink"}`}
              >
                {t(label)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
