"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toDocument, type DocModel } from "@/biodata/document";
import { blockTexts } from "@/document/blocks/texts";
import type { PhotoInput } from "@/document/blocks/types";
import { getTemplate } from "@/document/templates";
import { DocumentView, type DocumentLayoutInfo } from "@/document/DocumentView";
import { getDocDictionary } from "@/i18n/doc";
import { readDisplayList, type DisplayList } from "@/pdf/display-list";
import { pageImageFileName, pdfFileName } from "@/biodata/filename";
import type { LangCode } from "@/biodata/types";
import { documentVariants, FIXTURE_TODAY, mixedScriptVariants, type DocVariant } from "../../../../test/fixtures/documents";
import { pdfHarness, type PdfHarness } from "../pdf/harness";

// The document engine's dev page (BUILD_PLAN Step 3.2): every fixture variant laid out at true size (Step 4.3 adds
// designs 3–10, each in English, Telugu and one more Indic language and in all three colours), plus the short
// Classic Gold biodata in each of the other eight document languages (Step 4.2) to check glyphs and label widths,
// and four biodatas with values typed in other scripts than the page's (Step 4.2, `mixedScriptVariants`).
// When all are laid out, <body data-doc-ready> is set and window.__doc lets the e2e spec read each variant's page
// count, the text it should print and the display list of its pages (the Download engine's input, D49), and
// `pdf(id)` runs the Download engine on a variant (Step 4.1; the PDF and Images buttons download them by hand).

declare global {
  interface Window {
    __doc?: {
      variants: { id: string; length: string; pages: number; step: string; overflow: boolean; expected: string[] }[];
      displayList: (id: string) => DisplayList;
      /** The Download engine on one variant's pages (Step 4.1, e2e/pdf.spec.ts). */
      pdf: (id: string) => PdfHarness;
    };
  }
}

/** A neutral placeholder portrait (dev page only: in a real document an absent photo leaves no frame). */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="600" height="900">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#d6cdbf"/></linearGradient></defs>
  <rect width="300" height="450" fill="url(#p)"/>
  <circle cx="150" cy="170" r="60" fill="#b9ad9b"/>
  <path d="M40 450c0-100 50-165 110-165s110 65 110 165z" fill="#a89a86"/>
</svg>`;

async function placeholderJpeg(): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 900;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 600, 900);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** The languages beyond English and Telugu, each shown once (Classic Gold, short). */
const MORE_LANGUAGES: LangCode[] = ["hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"];

function galleryVariants(): DocVariant[] {
  const all = documentVariants();
  const base = all.find((v) => v.id === "classic-gold-en-short")!;
  const more = MORE_LANGUAGES.map((lang) => {
    const profile = structuredClone(base.profile);
    profile.docLanguage = lang;
    return { ...base, id: `classic-gold-${lang}-short`, lang, profile };
  });
  return [...all, ...more, ...mixedScriptVariants()];
}

/** Dev-only: download a variant as the Download engine makes it (the editor's buttons come in Step 4.1 part 2). */
function DownloadButtons({ root, profile }: { root: () => HTMLElement | undefined; profile: DocVariant["profile"] }) {
  const save = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const style = { font: "inherit", fontSize: 12, padding: "1px 8px", marginLeft: 6 };
  return (
    <>
      <button
        type="button"
        style={style}
        onClick={async () => {
          const { createPdf } = await import("@/pdf");
          save(await createPdf(root()!), pdfFileName(profile));
        }}
      >
        PDF
      </button>
      <button
        type="button"
        style={style}
        onClick={async () => {
          const { createPageImages } = await import("@/pdf");
          (await createPageImages(root()!, { format: "jpeg" })).forEach((b, i, all) => save(b, pageImageFileName(profile, i + 1, "jpeg", all.length)));
        }}
      >
        Images
      </button>
    </>
  );
}

export function DocumentGallery() {
  const variants = useMemo(
    () =>
      galleryVariants().map((v) => ({
        ...v,
        doc: toDocument(v.profile, getDocDictionary(v.profile.docLanguage), FIXTURE_TODAY) as DocModel,
      })),
    [],
  );
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<Record<string, DocumentLayoutInfo>>({});
  const roots = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    placeholderJpeg().then(setPhotoSrc);
  }, []);

  const photos = useMemo(() => {
    const map = new Map<string, PhotoInput | undefined>();
    for (const v of variants) map.set(v.id, photoSrc && v.photo ? { src: photoSrc, frame: v.photo } : undefined);
    return map;
  }, [variants, photoSrc]);

  const onLayout = useCallback((id: string, info: DocumentLayoutInfo) => setLayouts((l) => ({ ...l, [id]: info })), []);
  const callbacks = useMemo(() => new Map(variants.map((v) => [v.id, (info: DocumentLayoutInfo) => onLayout(v.id, info)])), [variants, onLayout]);

  const allLaidOut = photoSrc !== null && variants.every((v) => layouts[v.id]);
  useEffect(() => {
    if (!allLaidOut) return;
    window.__doc = {
      variants: variants.map((v) => {
        // What this template prints, plus every value of the document model (each must appear somewhere).
        const template = getTemplate(v.doc.templateId);
        const printed = blockTexts(template.blocks(v.doc, { photo: !!v.photo }), v.doc);
        const aside = template.asideTexts?.(v.doc, { photo: !!v.photo }) ?? [];
        const values = v.doc.sections.flatMap((s) => s.items.map((i) => (i.kind === "row" ? i.value : i.text)));
        return { id: v.id, length: v.length, ...layouts[v.id], expected: [...printed, ...aside, ...values] };
      }),
      displayList: (id) => readDisplayList(roots.current.get(id)!),
      pdf: (id) => pdfHarness(() => roots.current.get(id)!),
    };
    document.body.dataset.docReady = "1";
  }, [allLaidOut, layouts, variants]);

  if (photoSrc === null) return null;
  return (
    <div style={{ background: "#d6d3d1", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
      {variants.map((v) => (
        <section
          key={v.id}
          data-variant={v.id}
          ref={(el) => {
            if (el) roots.current.set(v.id, el);
          }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
        >
          <h2 style={{ font: "600 14px/1.4 system-ui, sans-serif", color: "#292524", margin: 0 }}>
            {v.id} {layouts[v.id] ? `· ${layouts[v.id].pages} page(s) at ${layouts[v.id].step}` : ""}{" "}
            <DownloadButtons root={() => roots.current.get(v.id)} profile={v.profile} />
          </h2>
          <DocumentView doc={v.doc} photo={photos.get(v.id)} onLayout={callbacks.get(v.id)} />
        </section>
      ))}
    </div>
  );
}
