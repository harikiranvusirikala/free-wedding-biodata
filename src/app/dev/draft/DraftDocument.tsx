"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toDocument } from "@/biodata/document";
import type { BiodataProfile } from "@/biodata/types";
import { DocumentView, type DocumentLayoutInfo } from "@/document/DocumentView";
import { getDocDictionary } from "@/i18n/doc";
import { openDb } from "@/lib/db";
import { useDocumentPhoto } from "@/lib/document-photo";
import { createProfileRepo } from "@/lib/profile-repo";

// Dev only: the draft named in the address, as the document engine lays it out, with its stored photo cropped in
// (src/lib/document-photo.ts, the same helper the live preview uses in Step 3.3). <body data-doc-ready> is set
// once it is laid out with its photo; a draft that can't be read shows why.

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
    if (layout && photo.ready) document.body.dataset.docReady = "1";
  }, [layout, photo.ready]);

  if (problem) return <p style={{ padding: 24, font: "14px system-ui, sans-serif" }}>{problem}</p>;
  if (!doc) return null;
  return (
    <div style={{ background: "#d6d3d1", padding: "24px 0", minHeight: "100vh" }} data-testid="draft-document">
      {photo.ready && <DocumentView doc={doc} photo={photo.photo} onLayout={setLayout} />}
    </div>
  );
}
