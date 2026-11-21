import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-line px-4 sm:px-6 lg:px-8">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-4 py-16 sm:px-6">
        <p className="text-xs font-bold tracking-[0.12em] text-brand-ink uppercase">Page not found</p>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-ink-2">The address may be mistyped, or the page has moved. Your drafts are safe in this browser.</p>
        <a
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-card hover:bg-brand-hover pointer-coarse:min-h-11"
        >
          Go to the home page
        </a>
      </main>
    </div>
  );
}
