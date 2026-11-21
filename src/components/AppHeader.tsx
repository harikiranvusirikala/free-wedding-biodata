import { Logo } from "@/components/Logo";
import { ThemeMenu } from "@/components/ThemeMenu";
import { iconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * The editor's compact header (mockup: editor): logo, then the theme menu and Help on the right. The drafts
 * menu, save status and Backup join it in the steps that make them work (BUILD_PLAN Part B rule 4).
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <Logo />
      <div className="ml-auto flex items-center gap-1">
        <ThemeMenu />
        <a href="/help" aria-label={t("nav.help")} title={t("nav.help")} className={iconButton}>
          <Icon name="help" className="size-5" />
        </a>
      </div>
    </header>
  );
}
