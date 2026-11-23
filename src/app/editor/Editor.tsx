"use client";

import { useEffect, useState } from "react";
import { button } from "@/components/ui/button";
import { card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingNote, Skeleton } from "@/components/ui/Skeleton";
import { createAutosave, type AutosaveController } from "@/lib/autosave";
import { openDb, type BiodataDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { LANG_CODES, type LangCode } from "@/biodata/types";
import { DESIGN_CATALOG } from "@/document/templates/catalog";
import { createDraft, draftRequest, openDraft, openNewDraft, type DraftStart, type OpenDraftResult } from "@/lib/open-draft";
import { createProfileRepo, type ProfileRepo } from "@/lib/profile-repo";
import { registerServiceWorker } from "@/lib/service-worker";
import { DraftEditor } from "./DraftEditor";
import { EditorFrame } from "./EditorFrame";

// The editor's start (BUILD_PLAN Steps 1.3, 1.4): open the database, then the draft in the address (?d=<id>), a
// new one for ?new=1 (Create my biodata, New draft; with &design=<id> from the design gallery, in that design), else the last one opened here, else a new one. Its id goes
// into the address (replacing ?new=1) so a reload reopens it. Each way it can fail has its own screen; a draft
// that can't be opened is never replaced or deleted.

type EditorState =
  | { kind: "loading" }
  | Exclude<OpenDraftResult, { kind: "ready" }>
  | { kind: "ready"; controller: AutosaveController; repo: ProfileRepo; db: BiodataDb };

// One start per page load. The editor is only ever reached by a full page load (links into it are plain <a>), and
// React's development double effects must not create two drafts.
let started: Promise<EditorState> | undefined;

async function start(): Promise<EditorState> {
  const db = openDb();
  const repo = createProfileRepo(db);
  const request = draftRequest(window.location.search);
  const result = request.fresh ? await openNewDraft(repo, undefined, requestedStart(request)) : await openDraft(repo, request.id);
  if (result.kind === "ready") {
    showInAddress(result.profile.id);
    return { kind: "ready", controller: createAutosave({ repo, initial: result.profile }), repo, db };
  }
  // A broken last-opened draft is named in the address too, so a reload shows the same thing.
  if (result.kind === "broken") showInAddress(result.id);
  return result;
}

/** How the address asks a new draft to start (`&design=<id>` from the gallery, `&lang=<code>` from a language page), if those exist. */
function requestedStart({ design, lang }: { design: string | null; lang: string | null }): DraftStart {
  const found = design ? DESIGN_CATALOG.find((t) => t.id === design) : undefined;
  return {
    ...(found ? { templateId: found.id, colorId: found.colors[0].id } : {}),
    ...(lang && (LANG_CODES as readonly string[]).includes(lang) ? { docLanguage: lang as LangCode } : {}),
  };
}

/** Puts ?d=<id> in the address without a new history entry (Next.js keeps its router in step). */
function showInAddress(id: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("d") === id && !url.searchParams.has("new")) return;
  url.searchParams.delete("new");
  url.searchParams.delete("design");
  url.searchParams.delete("lang");
  url.searchParams.set("d", id);
  window.history.replaceState(null, "", url);
}

export function Editor() {
  const [state, setState] = useState<EditorState>({ kind: "loading" });

  // The offline worker (Step 5.2): the editor, its fonts and the PDF engine are kept for use without a network.
  useEffect(registerServiceWorker, []);

  useEffect(() => {
    let cancelled = false;
    void (started ??= start()).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "ready") return <DraftEditor controller={state.controller} repo={state.repo} db={state.db} />;
  return (
    <EditorFrame>
      {state.kind === "loading" ? <LoadingEditor /> : <OpenProblem state={state} />}
    </EditorFrame>
  );
}

/** The ready layout's outline while the draft is read (usually a blink): rail, form cards and the right column. */
function LoadingEditor() {
  return (
    <div className="flex-1 lg:grid lg:grid-cols-[4rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)]" data-testid="editor-loading">
      <LoadingNote />
      <div className="space-y-2 border-r border-line bg-surface px-3 py-5 max-lg:hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 rounded-lg" />
        ))}
      </div>
      <div className="h-[3.25rem] border-b border-line bg-surface lg:hidden" />
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 sm:px-6 sm:py-6 lg:mx-0 lg:max-w-none lg:px-5">
        <div className={`${card} h-48`} />
        <div className={`${card} h-[26rem]`} />
      </div>
      <div className="max-lg:hidden lg:border-l lg:border-line lg:bg-sunken/40" />
    </div>
  );
}

/** Says why the draft couldn't be opened, and offers the way on. */
function OpenProblem({ state }: { state: Exclude<EditorState, { kind: "loading" | "ready" }> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function startNew() {
    setBusy(true);
    const result = await createDraft(createProfileRepo(openDb()));
    if (result.kind === "ready") {
      // A fresh page load for the new draft, so it opens exactly as a reload would.
      // (A full load on purpose, not the router: every start of the editor is one, see `started`.)
      const url = new URL("/editor", window.location.href);
      url.searchParams.set("d", result.profile.id);
      window.location.assign(url);
      return;
    }
    setBusy(false);
    setFailed(true);
  }

  const reload = () => window.location.reload();
  const newDraft = (
    <button type="button" className={button("primary", "lg")} onClick={startNew} disabled={busy}>
      {t("open.new")}
    </button>
  );
  const retry = (label: "open.retry" | "open.reload", variant: "primary" | "secondary") => (
    <button type="button" className={button(variant, "lg")} onClick={reload}>
      {t(label)}
    </button>
  );

  let content: { icon: "file" | "alert" | "lock"; tone: "brand" | "danger"; title: string; text: string; actions: React.ReactNode };
  if (failed || state.kind === "failed") {
    content = { icon: "alert", tone: "danger", title: t("open.failed.title"), text: t("open.failed.text"), actions: retry("open.retry", "primary") };
  } else if (state.kind === "missing") {
    content = { icon: "file", tone: "brand", title: t("open.missing.title"), text: t("open.missing.text"), actions: newDraft };
  } else if (state.kind === "broken") {
    const tooNew = state.code === "too-new";
    content = {
      icon: "alert",
      tone: "danger",
      title: t("open.broken.title"),
      text: t(tooNew ? "open.broken.tooNew" : "open.broken.invalid"),
      actions: (
        <>
          {newDraft}
          {tooNew && retry("open.reload", "secondary")}
        </>
      ),
    };
  } else {
    content = { icon: "lock", tone: "danger", title: t("open.unavailable.title"), text: t("open.unavailable.text"), actions: retry("open.retry", "primary") };
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6" data-testid="open-problem">
      <EmptyState as="h1" icon={content.icon} tone={content.tone} title={content.title} actions={content.actions}>
        <p>{content.text}</p>
      </EmptyState>
    </div>
  );
}
