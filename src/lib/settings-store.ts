import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./theme-script";

// The app's own settings in localStorage (BUILD_PLAN A2): for now the theme; the app language joins it when
// the first reviewed translation arrives (VISION D23). Read with useSyncExternalStore, so every theme menu
// and every open tab agree. Nothing here is personal: drafts live in IndexedDB (Step 1.3).

export type Theme = "light" | "dark";
/** What the person chose: a theme, or to follow the device ("system", which saves nothing). */
export type ThemeChoice = Theme | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const deviceMedia = () => (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null); // jsdom has none

/** With storage blocked (some private modes), a choice lasts until the page is reloaded. */
let unsaved: Theme | null = null;

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return unsaved;
  }
}

/** The theme a choice comes to on this device. Pure, so it is unit-tested. */
export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): Theme {
  if (choice === "system") return deviceIsDark ? "dark" : "light";
  return choice;
}

/** What the person chose, read straight from storage (browser only). */
export function getThemeChoice(): ThemeChoice {
  return saved() ?? "system";
}

/** Puts the theme on <html>, as THEME_SCRIPT does on page load. */
function apply() {
  const theme = resolveTheme(getThemeChoice(), deviceMedia()?.matches ?? false);
  document.documentElement.classList.toggle("dark", theme === "dark");
  notify();
}

/** Remembers the choice in this browser (Follow device forgets it) and switches the page. */
export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    unsaved = choice === "system" ? null : choice;
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const device = deviceMedia();
  // Following the device: switch when it does (automatic night mode at sunset). A saved choice wins.
  const deviceChanged = () => apply();
  // Another tab chose.
  const storageChanged = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) apply();
  };
  device?.addEventListener("change", deviceChanged);
  window.addEventListener("storage", storageChanged);
  return () => {
    listeners.delete(listener);
    device?.removeEventListener("change", deviceChanged);
    window.removeEventListener("storage", storageChanged);
  };
}

/**
 * What the person chose, or undefined on the server and until hydration (a static page can't know it), so
 * nothing renders a wrong guess. The page's colours never wait for this: THEME_SCRIPT has already set them.
 */
export function useThemeChoice(): ThemeChoice | undefined {
  return useSyncExternalStore(subscribe, getThemeChoice, () => undefined);
}
