"use client";

import { useEffect, useState } from "react";
import { button } from "@/components/ui/button";
import { card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingNote, Skeleton } from "@/components/ui/Skeleton";
import { pageWidth } from "@/components/ui/page";
import { createAutosave, type AutosaveController } from "@/lib/autosave";
import { openDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { createDraft, openDraft, type OpenDraftResult } from "@/lib/open-draft";
import { createProfileRepo } from "@/lib/profile-repo";
import { DraftEditor } from "./DraftEditor";
import { EditorFrame } from "./EditorFrame";

// The editor's start (BUILD_PLAN Step 1.3): open the database, then the draft in the address (?d=<id>), else the
// last one opened here, else a new one, whose id goes into the address so a reload reopens it. Each way it can
// fail has its own screen; a draft that can't be opened is never replaced or deleted.

type EditorState = { kind: "loading" } | Exclude<OpenDraftResult, { kind: "ready" }> | { kind: "ready"; controller: AutosaveController };

// One start per page load. The editor is only ever reached by a full page load (links into it are plain <a>), and
// React's development double effects must not create two drafts.
let started: Promise<EditorState> | undefined;

async function start(): Promise<EditorState> {
  const repo = createProfileRepo(openDb());
  const result = await openDraft(repo, new URLSearchParams(window.location.search).get("d"));
  if (result.kind === "ready") {
    showInAddress(result.profile.id);
    return { kind: "ready", controller: createAutosave({ repo, initial: result.profile }) };
  }
  // A broken last-opened draft is named in the address too, so a reload shows the same thing.
  if (result.kind === "broken") showInAddress(result.id);
  return result;
}

/** Puts ?d=<id> in the address without a new history entry (Next.js keeps its router in step). */
function showInAddress(id: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("d") === id) return;
  url.searchParams.set("d", id);
  window.history.replaceState(null, "", url);
}

export function Editor() {
  const [state, setState] = useState<EditorState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (started ??= start()).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "ready") return <DraftEditor controller={state.controller} />;
  return (
    <EditorFrame>
      {state.kind === "loading" ? <LoadingEditor /> : <OpenProblem state={state} />}
    </EditorFrame>
  );
}

/** The ready layout's outline while the draft is read (usually a blink). */
function LoadingEditor() {
  return (
    <div className={`${pageWidth} grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8`} data-testid="editor-loading">
      <LoadingNote />
      <div className="min-w-0">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="mt-3 h-5 w-full max-w-md rounded-md" />
        <div className={`mt-6 ${card} h-[22rem]`} />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
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
