import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SkipLink } from "@/components/SkipLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";
import { DraftParam } from "./DraftParam";

export const metadata: Metadata = {
  title: t("editor.metaTitle"),
  robots: { index: false, follow: false },
};

// Step 0.1: proves the static export can read a draft id from the address (?d=<id>). The editor itself comes
// in Phase 2. Outside the (public) group, so no analytics ever loads here (VISION D22).
export default function EditorPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <AppHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader title={t("editor.title")} description={t("editor.lead")} />
        <Suspense fallback={<Skeleton className="mt-6 h-[62px] rounded-2xl" />}>
          <DraftParam />
        </Suspense>
      </main>
    </div>
  );
}
