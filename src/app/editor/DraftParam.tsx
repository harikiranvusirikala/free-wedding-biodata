"use client";

import { useSearchParams } from "next/navigation";

/** Shows the draft id from ?d=, read in the browser (a static page has no server to read it). */
export function DraftParam() {
  const draftId = useSearchParams().get("d");
  return (
    <p className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm shadow-card" data-testid="draft-id">
      {draftId ? (
        <>
          Draft: <span className="font-mono font-semibold">{draftId}</span>
        </>
      ) : (
        "No draft selected."
      )}
    </p>
  );
}
