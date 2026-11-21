"use client";

import { useEffect, useState } from "react";
import { textLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { titleOf } from "@/lib/draft-title";
import { t } from "@/lib/i18n";

/**
 * "Continue editing Sai Teja's biodata" under Create my biodata (Step 1.4, mockup: landing), when this browser
 * has a draft. The page is static, so this reads IndexedDB only after hydration, with the storage code loaded
 * then (import()), keeping Dexie out of the public pages' first load. Its line is reserved from the start and
 * the link fades in, so nothing on the page moves. A plain <a>: a full page load into the editor (VISION D22).
 */
export function ContinueEditing() {
  const [draft, setDraft] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let live = true;
    import("@/lib/local-data")
      .then(({ findContinueDraft }) => findContinueDraft())
      .then((found) => {
        if (live && found) setDraft({ id: found.id, title: titleOf(found) });
      })
      .catch(() => {
        // No storage (a private window), or the code couldn't load: there is nothing to continue.
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="flex min-h-11 items-center justify-center" data-testid="continue-slot">
      {draft && (
        <a
          href={`/editor?d=${encodeURIComponent(draft.id)}`}
          className={`inline-flex min-h-11 max-w-full animate-fade-in items-center gap-1.5 px-2 text-[15px] motion-reduce:animate-none sm:text-base ${textLink}`}
          data-testid="continue-editing"
        >
          <span className="truncate">{t("home.continue", { name: draft.title })}</span>
          <Icon name="arrowRight" className="size-4" />
        </a>
      )}
    </div>
  );
}
