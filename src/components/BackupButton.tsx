"use client";

import { useEffect, useRef, useState } from "react";
import { button, type ButtonVariant } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import type { DownloadOutcome } from "@/lib/backup-file";
import { downloadFailureText } from "@/lib/backup-text";
import { t, type AppKey } from "@/lib/i18n";
import { formatBytes } from "@/lib/storage-status";

/**
 * "Download a backup first" (VISION §9, Step 5.1): the button the delete dialogs and the out-of-space message offer.
 * It runs `run` (which makes the file and starts its download), says in words that it is working, and then says
 * what was downloaded or why it wasn't. A backup is a copy the person keeps: the words never promise more. The
 * message under it is a live region, so a screen reader hears the result.
 */
export function BackupButton({
  run,
  hint,
  label = t("backup.first.button"),
  doneKey = "backup.first.done",
  variant = "secondary",
  disabled = false,
}: {
  run: () => Promise<DownloadOutcome>;
  /** Under the button until it has been used: what it saves. */
  hint?: string;
  label?: string;
  /** The message after a download; gets {name} and {size}. */
  doneKey?: AppKey;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const [state, setState] = useState<{ kind: "idle" | "working" } | { kind: "done" | "failed"; text: string }>({ kind: "idle" });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function click() {
    setState({ kind: "working" });
    let outcome: DownloadOutcome;
    try {
      outcome = await run();
    } catch {
      outcome = { ok: false, kind: "failed" };
    }
    if (!alive.current) return;
    if (!outcome.ok) return setState({ kind: "failed", text: downloadFailureText(outcome.kind) });
    const done = t(doneKey, { name: outcome.name, size: formatBytes(outcome.bytes) });
    setState({ kind: "done", text: outcome.unreadable ? `${done} ${t("backup.first.skipped", { count: outcome.unreadable })}` : done });
  }

  const working = state.kind === "working";
  const text = state.kind === "done" || state.kind === "failed" ? state.text : "";
  return (
    <div data-testid="backup-first">
      <button type="button" className={button(variant)} disabled={disabled || working} onClick={() => void click()}>
        {working ? <Spinner /> : <Icon name="download" className="size-4" />}
        {working ? t("backup.first.working") : label}
      </button>
      {hint && state.kind === "idle" && <p className="mt-2 text-[13px] text-pretty text-ink-3">{hint}</p>}
      <p
        role={state.kind === "failed" ? "alert" : "status"}
        aria-live="polite"
        data-testid="backup-first-status"
        className={text ? `mt-2 text-[13px] leading-relaxed text-pretty ${state.kind === "failed" ? "font-medium text-danger" : "text-good"}` : "sr-only"}
      >
        {text}
      </p>
    </div>
  );
}
