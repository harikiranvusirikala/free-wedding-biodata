import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ThemeMenu } from "@/components/ThemeMenu";
import { iconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * The editor's compact header (mockup: editor): logo, the open draft's save status beside it, then the theme
 * menu and Help on the right. The drafts menu and Backup join it in the steps that make them work (BUILD_PLAN
 * Part B rule 4). With a status, phones show the icon without the name, so the status fits at 360 px.
 */
export function AppHeader({ status }: { status?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:gap-4">
      <Logo compact={status !== undefined} />
      {status !== undefined && (
        <>
          <span aria-hidden className="h-6 w-px shrink-0 bg-line max-sm:hidden" />
          <div className="min-w-0 flex-1">{status}</div>
        </>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ThemeMenu />
        <a href="/help" aria-label={t("nav.help")} title={t("nav.help")} className={iconButton}>
          <Icon name="help" className="size-5" />
        </a>
      </div>
    </header>
  );
}
