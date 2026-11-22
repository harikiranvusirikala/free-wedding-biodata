import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ThemeMenu } from "@/components/ThemeMenu";
import { iconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * The editor's compact header (mockups: editor, editor-phone): logo, then the drafts menu (the open draft's name)
 * and its save status, then the theme menu and Help on the right. Backups live in the drafts menu
 * (Step 5.1), not as a header button. With a status, phones show the icon without the name; with the drafts menu too, phones stack the
 * draft's name over its status, as in the phone mockup, the whole two lines being the menu's button.
 */
export function AppHeader({ status, drafts }: { status?: ReactNode; drafts?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:gap-4">
      <Logo compact={status !== undefined} />
      {status !== undefined && (
        <>
          <span aria-hidden className="h-6 w-px shrink-0 bg-line max-sm:hidden" />
          {drafts ? (
            <div className="relative flex min-w-0 flex-1 items-center gap-3 max-sm:-ml-1">
              <div className="min-w-0 max-sm:flex-1">{drafts}</div>
              {/* Phones: under the name, inside the button's lower half; taps go through to the button. */}
              <div className="min-w-0 flex-1 max-sm:pointer-events-none max-sm:absolute max-sm:right-2 max-sm:bottom-1 max-sm:left-2">{status}</div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">{status}</div>
          )}
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
