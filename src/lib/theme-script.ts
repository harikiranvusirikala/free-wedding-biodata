// Day, Night or Follow device (VISION §5), put on <html> before the first paint so a page never flashes the
// wrong theme. A plain module (no "use client"): the root layout, a server component, inlines THEME_SCRIPT in
// <head>. A saved "light" or "dark" wins; with nothing saved (Follow device), the device's setting.
// settings-store.ts does the same after a choice, and keeps both in step through THEME_KEY.

/** The localStorage key: "light", "dark", or absent for Follow device. */
export const THEME_KEY = "theme";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;
