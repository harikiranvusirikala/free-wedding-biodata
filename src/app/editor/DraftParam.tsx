"use client";

import { useSearchParams } from "next/navigation";
import { card, cardBody } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/** Shows the draft id from ?d=, read in the browser (a static page has no server to read it). */
export function DraftParam() {
  const draftId = useSearchParams().get("d");
  return (
    <p className={`mt-6 ${card} ${cardBody} text-sm text-ink-2 break-words`} data-testid="draft-id">
      {draftId ? (
        <>
          {t("editor.draft")} <span className="font-mono font-semibold text-ink">{draftId}</span>
        </>
      ) : (
        t("editor.noDraft")
      )}
    </p>
  );
}
