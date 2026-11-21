"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** Throws while rendering in the browser (not while the static page is built, which would fail the build). */
export function Throws() {
  const inBrowser = useSyncExternalStore(noSubscription, () => true, () => false);
  if (inBrowser) throw new Error("A deliberate error, to show the error screen (/dev/error).");
  return null;
}
