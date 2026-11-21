import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SkipLink } from "@/components/SkipLink";

/** The page around every editor state: the header (with the save status once a draft is open), then the main area. */
export function EditorFrame({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <AppHeader status={status} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
