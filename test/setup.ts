import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom has no modal dialogs: stand-ins that only open and close them (browsers also make the page behind
// inert, which e2e tests cover).
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
});
