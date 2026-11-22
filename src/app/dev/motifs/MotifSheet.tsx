"use client";

import { useEffect, useRef } from "react";
import { MOTIF_IDS, Motif, motifTradition, tintMotif } from "@/document/motifs";
import { Page } from "@/document/Page";
import { loadDocumentFonts } from "@/document/measure";
import { getPalette, getTemplate } from "@/document/templates";
import type { Palette } from "@/document/tokens";
import { t, type AppKey } from "@/lib/i18n";
import "@/document/document.css";
import { pdfHarness, type PdfHarness } from "../pdf/harness";

// See page.tsx. When the fonts are ready and every gold picture is recoloured in each palette (no symbol is still
// an empty box), <body data-motifs-ready> is set and window.__motifs(i) runs the PDF writer and the page images on
// the i-th A4 page.

declare global {
  interface Window {
    __motifs?: (page: number) => PdfHarness;
  }
}

const PALETTES: { name: string; palette: Palette }[] = [
  { name: "Classic Gold", palette: getPalette(getTemplate("classic-gold"), "gold") },
  { name: "Royal Maroon", palette: getPalette(getTemplate("royal-maroon"), "maroon") },
  { name: "Executive Navy", palette: getPalette(getTemplate("executive-navy"), "navy") },
  { name: "Deepam, night", palette: getPalette(getTemplate("deepam"), "night") },
  { name: "Peacock, teal", palette: getPalette(getTemplate("peacock"), "teal") },
  { name: "Peacock, festive emerald", palette: getPalette(getTemplate("peacock"), "emerald") },
  { name: "Minimal Ivory, ink", palette: getPalette(getTemplate("minimal-ivory"), "ink") },
];

const name = (id: string) => t(`top.motif.${id}` as AppKey);

/** Every symbol at 34 px and 96 px on one palette's paper. */
function Strip({ title, palette }: { title: string; palette: Palette }) {
  return (
    <section data-testid="motif-strip" style={{ background: palette.paper, padding: "14px 16px 18px", borderRadius: 12 }}>
      <h2 style={{ margin: "0 0 10px", font: "600 13px system-ui", color: palette.label }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 112px)", gap: "14px 8px" }}>
        {MOTIF_IDS.map((id) => (
          <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Motif id={id} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={34} />
            <Motif id={id} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={96} />
            <span style={{ font: "500 11px system-ui", color: palette.label, textAlign: "center" }}>
              {name(id)} · {motifTradition(id)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MotifSheet() {
  const pages = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const tinted = Promise.all(PALETTES.flatMap(({ palette }) => MOTIF_IDS.map((id) => tintMotif(id, palette.ink))));
    Promise.all([loadDocumentFonts("en"), tinted]).then(async () => {
      // The symbols re-render with their tinted pictures as those arrive: wait until none is still pending.
      while (!cancelled && document.querySelector("[data-motif-pending]")) await new Promise(requestAnimationFrame);
      if (cancelled) return;
      window.__motifs = (i) => pdfHarness(() => pages.current!.querySelectorAll("[data-sheet-page]")[i]);
      document.body.dataset.motifsReady = "1";
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 16, background: "#d6d3d1", display: "grid", gap: 16, justifyContent: "start" }}>
      <div data-testid="motif-sheet" style={{ display: "grid", gap: 12 }}>
        {PALETTES.map(({ name: title, palette }) => (
          <Strip key={title} title={title} palette={palette} />
        ))}
      </div>
      <div ref={pages} className="doc-pages" style={{ display: "grid", gap: 16 }}>
        {PALETTES.slice(0, 3).map(({ name: title, palette }, i) => (
          <div key={title} data-sheet-page>
            <Page lang="en" palette={palette} box={{ top: 48, right: 48, bottom: 48, left: 48 }} bodyPx={12} number={i + 1}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", rowGap: 22, color: palette.label }}>
                {MOTIF_IDS.map((id) => (
                  <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Motif id={id} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={96} />
                    <div style={{ fontSize: "0.9em" }}>{name(id)}</div>
                  </div>
                ))}
              </div>
            </Page>
          </div>
        ))}
      </div>
    </main>
  );
}
