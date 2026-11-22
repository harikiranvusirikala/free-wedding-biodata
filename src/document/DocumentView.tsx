"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocModel } from "@/biodata/document";
import { blockPhoto, type PhotoInput, type PhotoPagesInput } from "./blocks/types";
import { layoutDocument, loadDocumentFonts, loadElementFonts, type DocumentLayout } from "./measure";
import { tintMotif } from "./motifs";
import { Page } from "./Page";
import { inputPageCounts } from "./photo-pages";
import { PhotoPageSet } from "./PhotoPages";
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
  /** Relaxed spacing: how far a one-page biodata's vertical gaps were stretched (1 = not at all). */
  relax: number;
}

export interface DocumentViewProps {
  doc: DocModel;
  /** The main photo's picture; without it no photo frame is drawn. */
  photo?: PhotoInput;
  /**
   * The second photo on page 1 (Step 4.4, D40; always the tall 2:3 frame), drawn only together with the main
   * photo: each design places it beside its details (Classic: beside a later section; Modern: low in the side
   * panel; Minimal: beside the main photo in the header). It is measured and paginated with the blocks.
   */
  secondPhoto?: PhotoInput;
  /**
   * The pages after the biodata: extra photos and the horoscope chart (Step 4.2b). They are not part of the layout:
   * the biodata's pages, Auto text size and relaxed spacing are decided without them.
   */
  photoPages?: PhotoPagesInput;
  onLayout?: (info: DocumentLayoutInfo) => void;
  className?: string;
  /** Relaxed spacing for a one-page biodata with room to spare (default on); only the dev page turns it off. */
  relaxSpacing?: boolean;
}

export function DocumentView({ doc, photo, secondPhoto: secondInput, photoPages, onLayout, className, relaxSpacing = true }: DocumentViewProps) {
  const template = getTemplate(doc.templateId);
  const palette = getPalette(template, doc.colorId);
  // The second photo prints only beside a main photo (D40).
  const secondPhoto = photo ? secondInput : undefined;
  const specs = useMemo(() => template.blocks(doc, { photo: !!photo, secondPhoto: !!secondPhoto }), [template, doc, photo, secondPhoto]);
  const steps = useMemo(() => (doc.textSize === "auto" ? template.autoSteps : [doc.textSize]), [doc.textSize, template]);
  const box0 = template.pageBox(0, doc);
  const contentWidth = PAGE.width - box0.left - box0.right;

  const measureRef = useRef<HTMLDivElement>(null);
  const ink = palette.ink;
  const [state, setState] = useState<{ layout: DocumentLayout; specs: typeof specs; doc: DocModel; photo?: PhotoInput; secondPhoto?: PhotoInput } | null>(null);
  const fresh = state?.specs === specs && state.doc === doc;
  const onLayoutRef = useRef(onLayout);
  useEffect(() => {
    onLayoutRef.current = onLayout;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A gold symbol picture is recoloured in the design's ink first (motifs/tinted.ts): the pages then show the
      // tinted one from their first paint, so nothing marked ready ever holds the untinted picture. Same size.
      await Promise.all([loadDocumentFonts(doc.lang), tintMotif(doc.motif, ink)]);
      const root = measureRef.current;
      if (cancelled || !root) return;
      // Text in another script (a Telugu name on an English page) brings its own fonts: loaded before measuring.
      await loadElementFonts(root);
      if (cancelled) return;
      const pageHeight = (i: number) => {
        const box = template.pageBox(i, doc);
        return PAGE.height - box.top - box.bottom;
      };
      const layout = layoutDocument(root, specs, steps, pageHeight, { relax: relaxSpacing });
      if (cancelled) return;
      setState({ layout, specs, doc, photo, secondPhoto });
      onLayoutRef.current?.({ pages: layout.pages.length, step: layout.step, overflow: layout.overflow, relax: layout.relax });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, photo, secondPhoto, specs, steps, template, relaxSpacing, ink]);

  const shown = state;
  const { BlockView } = template;
  const extra = inputPageCounts(photoPages);

  return (
    <div className={className} data-doc-ready={fresh ? "1" : undefined} data-doc-pages={fresh ? state.layout.pages.length : undefined} data-doc-step={fresh ? state.layout.step : undefined} data-doc-relax={fresh ? state.layout.relax : undefined} data-doc-photo-pages={fresh ? extra.photos : undefined} data-doc-chart-page={fresh ? extra.chart : undefined}>
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
                  <BlockView block={spec.block} doc={doc} palette={palette} photo={blockPhoto(spec.block, photo, secondPhoto)} secondPhoto={secondPhoto} mainFrame={photo?.frame} />
                </div>
              ))}
            </div>
          ))}
          {template.Aside ? (
            // Page 1's fixed side panel isn't measured, but its text may need fonts of another script too.
            <div data-measure-aside style={{ position: "relative", width: PAGE.width, height: PAGE.height, fontSize: BODY_PX[steps[0]], fontFamily: fontStack(doc.lang), lineHeight: LINE_HEIGHT }}>
              <template.Aside doc={doc} palette={palette} photo={photo} secondPhoto={secondPhoto} />
            </div>
          ) : null}
        </div>
      ) : null}
      {shown ? (
        <div className="doc-pages">
          {shown.layout.pages.map((page, p) => {
            const t = getTemplate(shown.doc.templateId);
            const pal = getPalette(t, shown.doc.colorId);
            return (
              <Page
                key={p}
                number={p + 1}
                lang={shown.doc.lang}
                palette={pal}
                Frame={t.Frame}
                box={t.pageBox(p, shown.doc)}
                bodyPx={shown.layout.bodyPx}
                relax={shown.layout.relax}
                decor={p === 0 && t.Aside ? <t.Aside doc={shown.doc} palette={pal} photo={shown.photo} secondPhoto={shown.secondPhoto} /> : null}
              >
                {page.fragments.map((f) => {
                  const spec = shown.specs[f.block];
                  const piece = f.fromLine !== undefined ? shown.layout.pieces.get(f.block)?.get(f.fromLine) : undefined;
                  return (
                    <div key={`${spec.block.id}:${f.fromLine ?? 0}`} data-block={f.block} style={{ flex: "none", marginTop: f.spaceBefore }}>
                      <t.BlockView
                        block={spec.block}
                        doc={shown.doc}
                        palette={pal}
                        photo={blockPhoto(spec.block, shown.photo, shown.secondPhoto)}
                        secondPhoto={shown.secondPhoto}
                        mainFrame={shown.photo?.frame}
                        text={piece}
                        continued={!!f.fromLine}
                      />
                    </div>
                  );
                })}
              </Page>
            );
          })}
          {photoPages && extra.total ? <PhotoPageSet input={photoPages} doc={shown.doc} firstNumber={shown.layout.pages.length + 1} bodyPx={shown.layout.bodyPx} /> : null}
        </div>
      ) : null}
    </div>
  );
}
