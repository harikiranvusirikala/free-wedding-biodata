import type { ReactNode } from "react";
import { pageTitle } from "./page";

/** A page's title with one sentence under it, and its main buttons on the right (below it on phones). */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className={pageTitle}>{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-pretty text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
