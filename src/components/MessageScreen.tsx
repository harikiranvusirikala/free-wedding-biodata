import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { SkipLink } from "@/components/SkipLink";
import { ThemeMenu } from "@/components/ThemeMenu";
import { pageWidth } from "@/components/ui/page";

/**
 * A screen that says one thing (page not found, something went wrong): a slim header with the logo and the
 * theme menu, and the message centred in the space below. Used outside the public layout, so it brings its
 * own header.
 */
export function MessageScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b border-line">
        <div className={`${pageWidth} flex h-14 items-center sm:h-16`}>
          <Logo />
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
