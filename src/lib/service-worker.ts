"use client";

import { useSyncExternalStore } from "react";

// Registers the offline service worker (public/sw.js, Step 5.2) and says, truthfully, whether this page is
// running under it. Production builds only (never `next dev`, whose files change all the time), never on /dev/*,
// and only where the browser has service workers (a secure context: https, or localhost).

export const SERVICE_WORKER_URL = "/sw.js";

export interface RegisterContext {
  production: boolean;
  pathname: string;
  supported: boolean;
}

/** Whether this page should register the worker. Pure. */
export function shouldRegister({ production, pathname, supported }: RegisterContext): boolean {
  return production && supported && pathname !== "/dev" && !pathname.startsWith("/dev/");
}

/** Registers the worker once the page has loaded, so its download (the app's files, a few MB) never slows the page. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  const context = { production: process.env.NODE_ENV === "production", pathname: window.location.pathname, supported: "serviceWorker" in navigator && window.isSecureContext };
  if (!shouldRegister(context)) return;
  const register = () => {
    // updateViaCache "none": every check for a new version asks the server, never the HTTP cache.
    navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" }).catch(() => {
      // Refused (private browsing, blocked by policy or a test): the editor works as before, just not offline.
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

function subscribe(onChange: () => void) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const container = navigator.serviceWorker;
  container.addEventListener("controllerchange", onChange);
  return () => container.removeEventListener("controllerchange", onChange);
}

/**
 * True once the offline worker controls this page. It takes control only after every file of the app is kept
 * (a worker that couldn't keep them all never installs), so this is the moment the editor really works offline.
 */
export function useOfflineReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
    () => false,
  );
}
