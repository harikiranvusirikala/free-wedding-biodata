"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Page } from "@/document/Page";
import { loadDocumentFonts } from "@/document/measure";
import { CLASSIC_GOLD_COLORS } from "@/document/tokens";
import "@/document/document.css";
import { pdfHarness, type PdfHarness } from "./harness";

// See page.tsx. Fictional text only. When the fonts and pictures are ready, <body data-pdf-ready> is set and
// window.__pdf runs the engine on this page (e2e/pdf.spec.ts).

declare global {
  interface Window {
    __pdf?: PdfHarness;
  }
}

const palette = CLASSIC_GOLD_COLORS[0];

const LATIN =
  "Someone kind, family-minded and independent, who enjoys travel and simple living, and who values honesty and " +
  "respect for both families. Working or not is her choice; we would like to live in Hyderabad or Bengaluru.";
const KANNADA =
  "ನಾನು ಗುಂಟೂರಿನಲ್ಲಿ ಬೆಳೆದೆ. ಎಂಜಿನಿಯರಿಂಗ್ ನಂತರ ಹೈದರಾಬಾದ್‌ನಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದೇನೆ. ಅಡುಗೆ, ಕ್ರಿಕೆಟ್ ಮತ್ತು ಪ್ರವಾಸ " +
  "ನನಗೆ ಇಷ್ಟ. ಎರಡೂ ಕುಟುಂಬಗಳನ್ನು ಗೌರವಿಸುವ ಸಂಗಾತಿಯನ್ನು ಹುಡುಕುತ್ತಿದ್ದೇವೆ.";

/** A picture drawn on a canvas: JPEG (no alpha) or PNG (with a transparent corner). */
function drawn(type: "image/jpeg" | "image/png", w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d")!;
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#f6d7a7");
  g.addColorStop(1, "#7a4b3a");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#3d6b5c";
  c.beginPath();
  c.arc(w / 2, h / 2, Math.min(w, h) / 4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#c0392b";
  c.fillRect(0, 0, w / 8, h / 8);
  if (type === "image/png") c.clearRect(w - w / 6, h - h / 6, w / 6, h / 6);
  return canvas.toDataURL(type, 0.9);
}

const marker = <span data-marker style={{ display: "inline-block", width: 0, height: 0 }} />;

export function PdfFeatures() {
  const reactId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [pictures, setPictures] = useState<{ jpeg: string; png: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDocumentFonts("kn").then(() => {
      if (!cancelled) setPictures({ jpeg: drawn("image/jpeg", 600, 600), png: drawn("image/png", 300, 200) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pictures) return;
    const images = [...(root.current?.querySelectorAll("img") ?? [])];
    Promise.all(images.map((img) => img.decode())).then(() => {
      window.__pdf = pdfHarness(() => root.current!);
      document.body.dataset.pdfReady = "1";
    });
  }, [pictures]);

  if (!pictures) return null;
  return (
    <div ref={root} className="doc-pages" style={{ background: "#d6d3d1", padding: "24px 0" }}>
      <Page lang="kn" palette={palette} box={{ top: 56, right: 64, bottom: 56, left: 64 }} bodyPx={13.5} number={1}>
        <h1 data-check="center" style={{ textAlign: "center", fontSize: 26, fontWeight: 700, margin: 0, color: palette.label }}>
          ಬಯೋಡೇಟಾ Biodata
        </h1>
        <p data-check="right" style={{ textAlign: "right", margin: "4px 0 10px" }}>
          ದಿನಾಂಕ 14-08-1996
        </p>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <p data-check="justify" lang="en" style={{ textAlign: "justify", margin: "0 0 10px" }}>
              {LATIN}
            </p>
            <p data-check="justify-kn" style={{ textAlign: "justify", margin: "0 0 10px" }}>
              {KANNADA}
            </p>
            <div data-check="runs">
              <b style={{ color: palette.label }}>ಹೆಸರು</b> <span>:</span>
              <span style={{ marginLeft: 40 }}>Sai Teja Mandapati</span>
            </div>
            <div data-check="fallback" style={{ fontWeight: 700, color: palette.label }}>
              Blood group : B+ · ₹ 12,00,000 · ಹೆಸರು 2026
            </div>
            <div data-check="fallback-regular">Example Technologies Pvt. Ltd., Hyderabad ₹ 25,000</div>
            <p data-check="italic" style={{ margin: "6px 0" }}>
              <i>Fictional sample, not a real person.</i>
            </p>
            <p data-check="baseline" style={{ margin: 0, paddingTop: 0.25 }}>
              Baseline gy {marker}
            </p>
            <p data-check="baseline-kn" style={{ margin: 0, paddingTop: 0.4, fontWeight: 700 }}>
              ಜನ್ಮ ಸ್ಥಳ {marker}
            </p>
            <h2
              data-check="caps"
              lang="en"
              style={{ margin: "8px 0 0", padding: "2px 10px", background: palette.bar, color: palette.barText, fontSize: 15, letterSpacing: "0.035em", textTransform: "uppercase", borderBottom: `1px solid ${palette.rule}` }}
            >
              Family details
            </h2>
          </div>
          <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL at true size */}
            <img data-check="cover" src={pictures.jpeg} alt="" width={150} height={200} style={{ display: "block", width: 150, height: 200, objectFit: "cover", borderRadius: 12 }} />
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL at true size */}
            <img data-check="png" src={pictures.png} alt="" width={150} height={100} style={{ display: "block", width: 150, height: 100 }} />
            <svg data-check="gradient" viewBox="0 0 150 40" width={150} height={40} aria-hidden style={{ display: "block" }}>
              <defs>
                <linearGradient id=":r1:" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={palette.frame[0]} />
                  <stop offset="1" stopColor={palette.frame[1]} />
                </linearGradient>
                <linearGradient id={reactId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#7a1420" />
                  <stop offset="1" stopColor="#f6e3e3" />
                </linearGradient>
              </defs>
              <rect width="150" height="18" rx="4" fill="url(#:r1:)" />
              <rect y="22" width="150" height="18" rx="4" fill={`url(#${reactId})`} />
            </svg>
          </div>
        </div>
      </Page>
    </div>
  );
}
