"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocModel } from "@/biodata/document";
import type { PhotoInput } from "./blocks/types";
import { layoutDocument, loadDocumentFonts, type DocumentLayout } from "./measure";
import { Page } from "./Page";
import { getPalette, getTemplate } from "./templates";
import { BODY_PX, fontStack, LINE_HEIGHT, PAGE, type TextStep } from "./tokens";
import "./document.css";

// The document on screen (BUILD_PLAN A4): the template's blocks are measured off-screen at every text size Auto
// may use, paginated, and drawn as A4 pages at true size. The same pages are the live preview (scaled by its
// container, Step 3.3), the print output and the Download engine's input (D1, D49). While a new layout is being
// measured the previous pages stay on screen, so editing never flashes.

export interface DocumentLayoutInfo {
  pages: number;
  step: TextStep;
  /** A block taller than a page was clipped (only possible with extreme content). */
  overflow: boolean;
}

export interface DocumentViewProps {
  doc: DocModel;
  /** The main photo's picture; without it no photo frame is drawn. */
  photo?: PhotoInput;
  onLayout?: (info: DocumentLayoutInfo) => void;
  className?: string;
}

export function DocumentView({ doc, photo, onLayout, className }: DocumentViewProps) {
  const template = getTemplate(doc.templateId);
  const palette = getPalette(template, doc.colorId);
  const specs = useMemo(() => template.blocks(doc, { photo: !!photo }), [template, doc, photo]);
  const steps = useMemo(() => (doc.textSize === "auto" ? template.autoSteps : [doc.textSize]), [doc.textSize, template]);
  const box0 = template.pageBox(0, doc);
  const contentWidth = PAGE.width - box0.left - box0.right;

  const measureRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ layout: DocumentLayout; specs: typeof specs; doc: DocModel; photo?: PhotoInput } | null>(null);
  const fresh = state?.specs === specs && state.doc === doc;
  const onLayoutRef = useRef(onLayout);
  useEffect(() => {
    onLayoutRef.current = onLayout;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadDocumentFonts(doc.lang);
      const root = measureRef.current;
      if (cancelled || !root) return;
      const pageHeight = (i: number) => {
        const box = template.pageBox(i, doc);
        return PAGE.height - box.top - box.bottom;
      };
      const layout = layoutDocument(root, specs, steps, pageHeight);
      if (cancelled) return;
      setState({ layout, specs, doc, photo });
      onLayoutRef.current?.({ pages: layout.pages.length, step: layout.step, overflow: layout.overflow });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, photo, specs, steps, template]);

  const shown = state;
  const { BlockView } = template;

  return (
    <div className={className} data-doc-ready={fresh ? "1" : undefined} data-doc-pages={fresh ? state.layout.pages.length : undefined} data-doc-step={fresh ? state.layout.step : undefined}>
      {!fresh ? (
        // Off-screen measuring columns, one per text size to try. Never marked data-page, so never printed or exported.
        <div ref={measureRef} aria-hidden lang={doc.lang} style={{ position: "absolute", left: -20000, top: 0, visibility: "hidden", pointerEvents: "none" }}>
          {steps.map((step) => (
            <div
              key={step}
              data-measure-step={step}
              style={{ width: contentWidth, fontSize: BODY_PX[step], fontFamily: fontStack(doc.lang), lineHeight: LINE_HEIGHT, display: "flex", flexDirection: "column" }}
            >
              {specs.map((spec, i) => (
                <div key={spec.block.id} data-block={i} style={{ flex: "none" }}>
                  <BlockView block={spec.block} doc={doc} palette={palette} photo={photo} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {shown ? (
        <div className="doc-pages">
          {shown.layout.pages.map((page, p) => {
            const t = getTemplate(shown.doc.templateId);
            const pal = getPalette(t, shown.doc.colorId);
            return (
              <Page key={p} number={p + 1} lang={shown.doc.lang} palette={pal} Frame={t.Frame} box={t.pageBox(p, shown.doc)} bodyPx={shown.layout.bodyPx}>
                {page.fragments.map((f) => {
                  const spec = shown.specs[f.block];
                  const piece = f.fromLine !== undefined ? shown.layout.pieces.get(f.block)?.get(f.fromLine) : undefined;
                  return (
                    <div key={`${spec.block.id}:${f.fromLine ?? 0}`} data-block={f.block} style={{ flex: "none", marginTop: f.spaceBefore }}>
                      <t.BlockView block={spec.block} doc={shown.doc} palette={pal} photo={shown.photo} text={piece} continued={!!f.fromLine} />
                    </div>
                  );
                })}
              </Page>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
