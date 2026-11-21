"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ENGLISH_PAGE, SCRIPT_PAGES, type FixturePage, type FixtureSection } from "../../../test/fixtures/scripts";
import { readDisplayList, type DisplayList } from "../display-list";
import { FoliageFrame, GaneshaMotif, PORTRAIT_SVG } from "./ClassicGoldArt";
import "./spike.css";

// The spike's reference page (BUILD_PLAN Step 0.2): the fixture as A4 pages in a Classic Gold look. Page 1 is
// the English profile; its long About text continues on page 2 (split at a word, by measuring); then one page
// per Indian language. When everything is laid out, `window.__spike` exposes the display list and
// <body data-spike-ready> is set, for the e2e spike specs.

declare global {
  interface Window {
    __spike?: {
      displayList: () => DisplayList;
      photo: string;
      /** Candidate D and the image check, loaded on demand like the real Download engine would be. */
      raster: () => Promise<typeof import("../raster/raster")>;
      /** Candidate C, loaded on demand. */
      vector: () => Promise<typeof import("../vector/browser")>;
    };
  }
}

/** Where page content must end (px from the page top): A4 is 1123 px tall; the margin and page number sit below. */
const CONTENT_BOTTOM = 1123 - 72;

type Words = { paragraph: number; word: string }[];

const toWords = (paragraphs: string[]): Words => paragraphs.flatMap((p, paragraph) => p.split(/\s+/).map((word) => ({ paragraph, word })));
const toParagraphs = (words: Words): string[] => {
  const out: string[] = [];
  let current = -1;
  for (const { paragraph, word } of words) {
    if (paragraph !== current) {
      out.push(word);
      current = paragraph;
    } else out[out.length - 1] += ` ${word}`;
  }
  return out;
};

/** The placeholder portrait as a JPEG data URL, so the PDF engines embed a real raster photo. */
async function placeholderPhoto(): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PORTRAIT_SVG)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 600, 800);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function Rows({ rows }: { rows: FixtureSection["rows"] }) {
  return (
    <dl className="spike-rows">
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "contents" }}>
          <dt>{label} :</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Page({ page, number, total, children }: { page: FixturePage; number: number; total: number; children: React.ReactNode }) {
  return (
    <article className="spike-page" data-page lang={page.lang} style={{ fontFamily: `"${page.fontFamily}", "Noto Sans", sans-serif` }}>
      <FoliageFrame />
      {children}
      <div className="spike-page-no" style={{ fontFamily: '"Noto Sans", sans-serif' }}>
        Page {number} of {total}
      </div>
    </article>
  );
}

function Head({ page }: { page: FixturePage }) {
  return (
    <>
      <div className="spike-motif-row">
        <GaneshaMotif />
      </div>
      <h1 className="spike-title">{page.lang === "en" ? page.title.toUpperCase() : page.title}</h1>
    </>
  );
}

function Bar({ page, children }: { page: FixturePage; children: React.ReactNode }) {
  return <h2 className={`spike-bar ${page.lang === "en" ? "latin" : ""}`}>{children}</h2>;
}

export function SpikePages() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [split, setSplit] = useState<number | null>(null);
  const firstInner = useRef<HTMLDivElement>(null);
  const aboutWords = useMemo(() => toWords(ENGLISH_PAGE.about!.paragraphs), []);
  const total = 2 + SCRIPT_PAGES.length;

  useEffect(() => {
    placeholderPhoto().then(setPhoto);
  }, []);

  // Fit as many About words on page 1 as the page holds: measure an off-screen copy of page 1's content.
  useEffect(() => {
    if (!photo || split !== null) return;
    let cancelled = false;
    (async () => {
      await document.fonts.ready;
      const inner = firstInner.current;
      if (!inner || cancelled) return;
      const probe = inner.cloneNode(true) as HTMLDivElement;
      const holder = document.createElement("div");
      holder.className = "spike-page";
      holder.style.cssText = "position:absolute;left:-10000px;top:0;font-family:'Noto Sans'";
      holder.appendChild(probe);
      document.body.appendChild(holder);
      const about = probe.querySelector<HTMLElement>(".spike-about-text")!;
      const fits = (n: number) => {
        about.replaceChildren(
          ...toParagraphs(aboutWords.slice(0, n)).map((text) => {
            const p = document.createElement("p");
            p.textContent = text;
            return p;
          }),
        );
        // The last line must end above the bottom margin and the page number.
        const bottom = about.getBoundingClientRect().bottom - holder.getBoundingClientRect().top;
        return bottom <= CONTENT_BOTTOM;
      };
      let lo = 0;
      let hi = aboutWords.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(mid)) lo = mid;
        else hi = mid - 1;
      }
      holder.remove();
      if (!cancelled) setSplit(lo);
    })();
    return () => {
      cancelled = true;
    };
  }, [photo, split, aboutWords]);

  useEffect(() => {
    if (split === null || !photo) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      window.__spike = { displayList: () => readDisplayList(), photo, raster: () => import("../raster/raster"), vector: () => import("../vector/browser") };
      document.body.dataset.spikeReady = "1";
    });
    return () => {
      cancelled = true;
    };
  }, [split, photo]);

  const [personal, ...others] = ENGLISH_PAGE.sections;
  const onFirst = split === null ? aboutWords : aboutWords.slice(0, split);
  const onSecond = split === null ? [] : aboutWords.slice(split);

  return (
    <div className="spike-root">
      <Page page={ENGLISH_PAGE} number={1} total={total}>
        <div className="spike-inner" ref={firstInner}>
          <Head page={ENGLISH_PAGE} />
          <section className="spike-sec spike-sec-photo">
            <div>
              <Bar page={ENGLISH_PAGE}>{personal.heading}</Bar>
              <Rows rows={personal.rows} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
            {photo ? <img className="spike-photo" src={photo} alt="" /> : <div className="spike-photo" />}
          </section>
          {others.map((section) => (
            <section key={section.heading} className="spike-sec">
              <Bar page={ENGLISH_PAGE}>{section.heading}</Bar>
              <Rows rows={section.rows} />
            </section>
          ))}
          <section className="spike-sec spike-about">
            <Bar page={ENGLISH_PAGE}>{ENGLISH_PAGE.about!.heading}</Bar>
            <div className="spike-about-text">
              {toParagraphs(onFirst).map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </section>
        </div>
      </Page>

      <Page page={ENGLISH_PAGE} number={2} total={total}>
        <div className="spike-inner">
          <section className="spike-sec spike-about">
            <Bar page={ENGLISH_PAGE}>{ENGLISH_PAGE.about!.heading} (continued)</Bar>
            <div className="spike-about-text">
              {toParagraphs(onSecond).map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </section>
        </div>
      </Page>

      {SCRIPT_PAGES.map((page, i) => (
        <Page key={page.lang} page={page} number={3 + i} total={total}>
          <div className="spike-inner">
            <Head page={page} />
            {page.sections.map((section) => (
              <section key={section.heading} className="spike-sec">
                <Bar page={page}>{section.heading}</Bar>
                <Rows rows={section.rows} />
              </section>
            ))}
            {page.about && (
              <section className="spike-sec spike-about">
                <Bar page={page}>{page.about.heading}</Bar>
                {page.about.paragraphs.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </section>
            )}
          </div>
        </Page>
      ))}
    </div>
  );
}
