import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { shouldRegister, useOfflineReady } from "./service-worker";

describe("shouldRegister", () => {
  it("registers the worker in a production build of the editor", () => {
    expect(shouldRegister({ production: true, pathname: "/editor", supported: true })).toBe(true);
  });

  it.each([
    ["a development build", { production: false, pathname: "/editor", supported: true }],
    ["a /dev page", { production: true, pathname: "/dev/pdf", supported: true }],
    ["/dev itself", { production: true, pathname: "/dev", supported: true }],
    ["a browser without service workers", { production: true, pathname: "/editor", supported: false }],
  ])("never in %s", (_, context) => {
    expect(shouldRegister(context)).toBe(false);
  });
});

describe("useOfflineReady", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "serviceWorker", original);
    else delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  function fakeContainer(controller: object | null) {
    const target = new EventTarget();
    const container = Object.assign(target, { controller });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
    return container;
  }

  it("is false without service workers, and while no worker controls the page", () => {
    expect(renderHook(() => useOfflineReady()).result.current).toBe(false);
    fakeContainer(null);
    expect(renderHook(() => useOfflineReady()).result.current).toBe(false);
  });

  it("turns true when the worker takes control (after it kept every file)", async () => {
    const container = fakeContainer(null);
    const { result, rerender } = renderHook(() => useOfflineReady());
    expect(result.current).toBe(false);
    container.controller = {};
    container.dispatchEvent(new Event("controllerchange"));
    rerender();
    expect(result.current).toBe(true);
  });
});
