import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { THEME_KEY, THEME_SCRIPT } from "./theme-script";
import { getThemeChoice, resolveTheme, setThemeChoice, useThemeChoice } from "./settings-store";

/** A stand-in for the device's Day/Night setting (jsdom has no matchMedia), which can change. */
function fakeDevice(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return dark;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    set(value: boolean) {
      dark = value;
      listeners.forEach((listener) => listener());
    },
  };
}

const isDark = () => document.documentElement.classList.contains("dark");

function Choice() {
  return <p>{useThemeChoice() ?? "unknown"}</p>;
}

beforeEach(() => {
  fakeDevice(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveTheme", () => {
  test("a choice wins; Follow device follows the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("THEME_SCRIPT (before the first paint)", () => {
  const run = () => new Function(THEME_SCRIPT)();

  test("a saved Night or Day wins over the device", () => {
    fakeDevice(false);
    localStorage.setItem(THEME_KEY, "dark");
    run();
    expect(isDark()).toBe(true);
    fakeDevice(true);
    localStorage.setItem(THEME_KEY, "light");
    run();
    expect(isDark()).toBe(false);
  });

  test("with nothing saved (or something odd), it follows the device", () => {
    fakeDevice(true);
    run();
    expect(isDark()).toBe(true);
    fakeDevice(false);
    localStorage.setItem(THEME_KEY, "purple");
    run();
    expect(isDark()).toBe(false);
  });
});

describe("settings store", () => {
  test("Night and Day are saved and applied; Follow device forgets the choice", () => {
    setThemeChoice("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(isDark()).toBe(true);
    setThemeChoice("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(isDark()).toBe(false);
    setThemeChoice("system");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(getThemeChoice()).toBe("system");
  });

  test("the hook shows the choice and updates when it changes", () => {
    render(<Choice />);
    expect(screen.getByText("system")).toBeDefined();
    act(() => setThemeChoice("dark"));
    expect(screen.getByText("dark")).toBeDefined();
  });

  test("following the device, the page switches when the device does; a saved choice doesn't", () => {
    const device = fakeDevice(false);
    render(<Choice />); // subscribes to the device
    act(() => device.set(true));
    expect(isDark()).toBe(true);
    act(() => setThemeChoice("light"));
    act(() => device.set(true));
    expect(isDark()).toBe(false);
  });

  test("a choice made in another tab arrives through the storage event", () => {
    render(<Choice />);
    localStorage.setItem(THEME_KEY, "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
    });
    expect(screen.getByText("dark")).toBeDefined();
    expect(isDark()).toBe(true);
  });

  test("with storage blocked, a choice still applies until the page is reloaded", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setThemeChoice("dark");
    expect(isDark()).toBe(true);
    expect(getThemeChoice()).toBe("dark");
    vi.restoreAllMocks();
  });
});
