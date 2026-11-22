// Getting the biodata out of the editor (BUILD_PLAN Step 4.1 part 2, VISION §11, D38, D49): the laid-out preview
// pages copied, unscaled, into an off-screen holder (the Download engine and the printer read that copy), a file
// saved through a download link, files handed to the share sheet, and printing from the browser's menu.
//
// Why a copy: the preview shows the pages scaled to fit its pane and, on phones, inside a sheet that may be hidden.
// A deep copy of the same laid-out pages ([data-page][lang], D1: nothing is laid out again by our code) placed at
// true size, visible but off-screen, gives the engine exactly what /dev/document and /dev/pdf give it, whatever the
// preview's zoom. SVG ids are renamed in the copy so its gradients never point back into the preview.

const HOLDER = "doc-copy";
const PRINT_HOLDER = "print-pages";

let copies = 0;

/**
 * Renames every id under `root` (suffix `-<suffix>`) and every reference to one (`url(#id)`, `href="#id"`), so a copy
 * of an SVG drawing is self-contained when the original is still in the document.
 */
export function uniquifyIds(root: Element, suffix: string): void {
  const renamed = new Map<string, string>();
  for (const el of root.querySelectorAll("[id]")) {
    const next = `${el.id}-${suffix}`;
    renamed.set(el.id, next);
    el.id = next;
  }
  if (!renamed.size) return;
  const swap = (value: string) =>
    value.replace(/url\((['"]?)#([^'")]+)\1\)/g, (match, quote: string, id: string) => (renamed.has(id) ? `url(${quote}#${renamed.get(id)}${quote})` : match));
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      if (attr.name === "id") continue;
      if ((attr.name === "href" || attr.name === "xlink:href") && attr.value.startsWith("#")) {
        const target = renamed.get(attr.value.slice(1));
        if (target) el.setAttribute(attr.name, `#${target}`);
        continue;
      }
      if (attr.value.includes("url(")) {
        const next = swap(attr.value);
        if (next !== attr.value) el.setAttribute(attr.name, next);
      }
    }
  }
}

export interface PageCopy {
  /** The holder: pass it to createPdf / createPageImages. */
  root: HTMLElement;
  dispose: () => void;
}

/**
 * A copy of the laid-out pages (`pages`, DocumentView's .doc-pages) at true size, off-screen but rendered, with its
 * pictures decoded and fonts ready. `print` marks it as what the print stylesheet shows (globals.css).
 */
export function copyPagesNow(pages: Element, { print = false }: { print?: boolean } = {}): PageCopy {
  const clone = pages.cloneNode(true) as HTMLElement;
  clone.removeAttribute("style");
  uniquifyIds(clone, `c${++copies}`);
  const holder = document.createElement("div");
  holder.className = print ? `${HOLDER} ${PRINT_HOLDER}` : HOLDER;
  holder.setAttribute("aria-hidden", "true");
  // Visible (the display-list reader skips hidden elements) but far off-screen, and never in the way of a tap.
  holder.style.cssText = "position:fixed;left:-100000px;top:0;width:794px;pointer-events:none;";
  holder.append(clone);
  document.body.append(holder);
  return { root: holder, dispose: () => holder.remove() };
}

/** copyPagesNow, then waits for its pictures to decode and the fonts to be ready. */
export async function copyPages(pages: Element, options: { print?: boolean } = {}): Promise<PageCopy> {
  const copy = copyPagesNow(pages, options);
  try {
    await Promise.all([...copy.root.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)));
    if (document.fonts) await document.fonts.ready;
  } catch (error) {
    copy.dispose();
    throw error;
  }
  return copy;
}

/** Saves a file through a download link (blob: URLs are allowed by the editor's CSP; nothing leaves the device). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // iOS Safari reads the file after the click returns; a minute is plenty.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saves several files one after another (browsers may drop downloads started in the same instant). */
export async function saveBlobs(files: readonly { blob: Blob; name: string }[]): Promise<void> {
  for (const [i, file] of files.entries()) {
    if (i) await new Promise((resolve) => setTimeout(resolve, 250));
    saveBlob(file.blob, file.name);
  }
}

/** Whether this browser's share sheet takes files of these types (Web Share Level 2). */
export function canShareFiles(types: readonly string[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    const files = types.map((type, i) => new File([new Uint8Array(1)], `check-${i}.${type.split("/")[1]}`, { type }));
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "cancelled" | "needs-tap" | "unsupported";

/**
 * Opens the share sheet with `files`. A person closing the sheet is "cancelled", not an error. Safari allows a share
 * only shortly after a tap; when making the file took longer it refuses ("needs-tap"): the caller offers a button.
 */
export async function shareFiles(files: File[], title?: string): Promise<ShareResult> {
  if (typeof navigator.canShare !== "function" || !navigator.canShare({ files })) return "unsupported";
  try {
    await navigator.share(title ? { files, title } : { files });
    return "shared";
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    throw error;
  }
}

function removePrintCopies() {
  document.querySelectorAll(`.${PRINT_HOLDER}`).forEach((el) => el.remove());
}

/**
 * Printing from the browser's own menu (Ctrl+P): the same copy, made at once (pictures already decoded in the
 * preview usually draw in time). Returns the listener remover.
 */
export function printFromBrowserMenu(pages: () => Element | null): () => void {
  const before = () => {
    if (document.querySelector(`.${PRINT_HOLDER}`)) return; // already made
    const source = pages();
    if (source) copyPagesNow(source, { print: true });
  };
  const after = () => removePrintCopies();
  window.addEventListener("beforeprint", before);
  window.addEventListener("afterprint", after);
  return () => {
    window.removeEventListener("beforeprint", before);
    window.removeEventListener("afterprint", after);
  };
}
