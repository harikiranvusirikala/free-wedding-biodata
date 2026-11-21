"use client";

import { useEffect } from "react";
import { MessageScreen } from "@/components/MessageScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

/**
 * Something broke while showing a page: say so plainly, offer Try again (Next.js renders the page again) and
 * Home. The error goes to the browser's console only; nothing is reported anywhere (no analytics, VISION D15).
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <MessageScreen>
      <EmptyState
        as="h1"
        icon="alert"
        tone="danger"
        eyebrow={t("error.eyebrow")}
        title={t("error.title")}
        actions={
          <>
            <button type="button" onClick={() => retry()} className={button("primary")}>
              <Icon name="refresh" className="size-4" />
              {t("error.retry")}
            </button>
            <a href="/" className={button("secondary")}>
              <Icon name="home" className="size-4" />
              {t("error.home")}
            </a>
          </>
        }
      >
        {t("error.text")}
      </EmptyState>
    </MessageScreen>
  );
}
