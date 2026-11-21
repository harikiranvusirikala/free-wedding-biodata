"use client";

import { Icon, type IconName } from "@/components/ui/icons";
import { Menu, MenuLabel, menuItem } from "@/components/ui/Menu";
import { iconButton } from "@/components/ui/button";
import { t, type AppKey } from "@/lib/i18n";
import { THEME_CHOICES, setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/settings-store";

const CHOICES: Record<ThemeChoice, { label: AppKey; icon: IconName }> = {
  light: { label: "theme.light", icon: "sun" },
  dark: { label: "theme.dark", icon: "moon" },
  system: { label: "theme.system", icon: "monitor" },
};

/**
 * Day, Night or Follow device (VISION §5) as one icon button with a menu, in every header. The button shows
 * the theme in use (a sun by day, a moon by night), drawn by CSS from the `dark` class that the theme script
 * set before the first paint, so it is right before React starts and never swaps; the menu ticks the choice.
 */
export function ThemeMenu() {
  const current = useThemeChoice();
  return (
    <Menu
      label={t("theme.label")}
      buttonLabel={t("theme.label")}
      buttonTitle={current ? t("theme.current", { choice: t(CHOICES[current].label) }) : t("theme.label")}
      button={
        <>
          <Icon name="sun" className="size-5 dark:hidden" />
          <Icon name="moon" className="hidden size-5 dark:block" />
        </>
      }
      buttonClassName={iconButton}
      menuClassName="w-52"
    >
      {(close) => (
        <>
          <MenuLabel>{t("theme.label")}</MenuLabel>
          {THEME_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              role="menuitemradio"
              aria-checked={current === choice}
              onClick={() => {
                setThemeChoice(choice);
                close();
              }}
              className={menuItem}
            >
              <Icon name={CHOICES[choice].icon} className="size-[18px]" />
              <span className="flex-1">{t(CHOICES[choice].label)}</span>
              {current === choice && <Icon name="check" className="size-[18px] text-brand-ink" />}
            </button>
          ))}
        </>
      )}
    </Menu>
  );
}
