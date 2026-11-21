import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { DraftParam } from "./DraftParam";

export const metadata: Metadata = {
  title: "Editor",
  robots: { index: false, follow: false },
};

// Step 0.1: proves the static export can read a draft id from the address (?d=<id>). The editor itself comes
// in Phase 2. Outside the (public) group, so no analytics ever loads here (VISION D22).
export default function EditorPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b border-line bg-surface px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Editor</h1>
        <p className="mt-2 text-ink-2">The biodata editor is being built. Nothing you open here leaves this browser.</p>
        <Suspense fallback={<p className="mt-6 text-sm text-ink-3">Loading…</p>}>
          <DraftParam />
        </Suspense>
      </main>
    </div>
  );
}
