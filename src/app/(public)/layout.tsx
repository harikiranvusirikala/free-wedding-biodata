import { Logo } from "@/components/Logo";
import { SITE_NAME } from "@/lib/site";

/**
 * The public pages (/, /privacy, later /templates and /help). Step 6.1 adds Google Tag Manager here, and only
 * here, so the editor never loads it (VISION D22). Links into /editor are plain <a> (full page loads).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-page/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="ml-auto flex items-center gap-6 text-sm font-medium text-ink-3">
            <a href="/privacy" className="hover:text-ink">
              Privacy
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            {SITE_NAME} is a document tool only: it doesn&apos;t match or connect people.
          </p>
          <a href="/privacy" className="hover:text-ink">
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
