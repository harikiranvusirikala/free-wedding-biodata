"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toDocument, type DocModel } from "@/biodata/document";
import { blockTexts } from "@/document/blocks/texts";
import type { PhotoInput } from "@/document/blocks/types";
import { getTemplate } from "@/document/templates";
import { DocumentView, type DocumentLayoutInfo } from "@/document/DocumentView";
import { getDocDictionary } from "@/i18n/doc";
import { readDisplayList, type DisplayList } from "@/pdf-spike/display-list";
import { documentVariants, FIXTURE_TODAY } from "../../../../test/fixtures/documents";

// The document engine's dev page (BUILD_PLAN Step 3.2): every fixture variant laid out at true size. When all are
// laid out, <body data-doc-ready> is set and window.__doc lets the e2e spec read each variant's page count, the
// text it should print and the display list of its pages (the Download engine's input, D49).

declare global {
  interface Window {
    __doc?: {
      variants: { id: string; length: string; pages: number; step: string; overflow: boolean; expected: string[] }[];
      displayList: (id: string) => DisplayList;
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

export function DocumentGallery() {
  const variants = useMemo(
    () =>
      documentVariants().map((v) => ({
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
        const printed = blockTexts(getTemplate(v.doc.templateId).blocks(v.doc, { photo: !!v.photo }), v.doc);
        const values = v.doc.sections.flatMap((s) => s.items.map((i) => (i.kind === "row" ? i.value : i.text)));
        return { id: v.id, length: v.length, ...layouts[v.id], expected: [...printed, ...values] };
      }),
      displayList: (id) => readDisplayList(roots.current.get(id)!),
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
            {v.id} {layouts[v.id] ? `· ${layouts[v.id].pages} page(s) at ${layouts[v.id].step}` : ""}
          </h2>
          <DocumentView doc={v.doc} photo={photos.get(v.id)} onLayout={callbacks.get(v.id)} />
        </section>
      ))}
    </div>
  );
}
