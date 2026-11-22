"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toDocument } from "@/biodata/document";
import type { BiodataProfile } from "@/biodata/types";
import { DocumentView, type DocumentLayoutInfo } from "@/document/DocumentView";
import { getDocDictionary } from "@/i18n/doc";
import { openDb } from "@/lib/db";
import { useDocumentPhoto } from "@/lib/document-photo";
import { createProfileRepo } from "@/lib/profile-repo";
import { pdfHarness, type PdfHarness } from "../pdf/harness";

declare global {
  interface Window {
    /** The Download engine run on this page's unscaled pages (e2e compares the editor's output with it). */
    __draft?: PdfHarness;
  }
}

// Dev only: the draft named in the address, as the document engine lays it out, with its stored photo cropped in
// (src/lib/document-photo.ts, the same helper the live preview uses). <body data-doc-ready> is set once it is laid
// out with its photo; a draft that can't be read shows why. window.__draft runs the Download engine on these true-size
// pages: e2e/editor-download.spec.ts checks the editor's downloads (made from its scaled preview) match it.

let repo: ReturnType<typeof createProfileRepo> | undefined;
const getRepo = () => (repo ??= createProfileRepo(openDb()));

export function DraftDocument() {
  const [profile, setProfile] = useState<BiodataProfile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [layout, setLayout] = useState<DocumentLayoutInfo | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("d");
    void (async () => {
      if (!id) return setProblem("Add ?d=<draft id> to the address.");
      const result = await getRepo().load(id);
      if (result.ok) setProfile(result.profile);
      else setProblem(result.error.message);
    })();
  }, []);

  const doc = useMemo(() => (profile ? toDocument(profile, getDocDictionary(profile.docLanguage), new Date()) : null), [profile]);
  const loadBlob = useCallback(async (photoId: string) => {
    const result = await getRepo().getPhoto(photoId);
    return result.ok ? result.value?.blob : undefined;
  }, []);
  const photo = useDocumentPhoto(profile?.photo, loadBlob);

  useEffect(() => {
    if (!layout || !photo.ready) return;
    window.__draft = pdfHarness(() => document.querySelector("[data-testid=draft-document]")!);
    document.body.dataset.docReady = "1";
  }, [layout, photo.ready]);

  if (problem) return <p style={{ padding: 24, font: "14px system-ui, sans-serif" }}>{problem}</p>;
  if (!doc) return null;
  return (
    <div style={{ background: "#d6d3d1", padding: "24px 0", minHeight: "100vh" }} data-testid="draft-document">
      {photo.ready && <DocumentView doc={doc} photo={photo.photo} onLayout={setLayout} />}
    </div>
  );
}
