"use client";

import { useEffect, useState } from "react";
import { button } from "@/components/ui/button";
import { card, cardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { t } from "@/lib/i18n";
import { useOfflineReady } from "@/lib/service-worker";
import { useBackup } from "./BackupProvider";
import { formatBytes, readStorageStatus, requestPersistence, type PersistAnswer, type StorageStatus } from "@/lib/storage-status";

const ANSWERS = { granted: "storage.granted", declined: "storage.declined", failed: "storage.failed" } as const;

/**
 * Storage on this device (VISION §9, Step 1.4), in the editor's aside: how much space the drafts use, whether the
 * browser has promised to keep them, and "Keep my drafts safe", which asks it to and says exactly what it
 * answered. `savedAt` changes after every save, so the size follows the typing. Never a claim that browser
 * storage is a permanent backup: it says so, and offers Download a backup and Restore from a backup (Step 5.1).
 * Once the offline worker controls the page (Step 5.2), it also says the editor works here without internet.
 */
export function StorageCard({ savedAt }: { savedAt?: number }) {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [answer, setAnswer] = useState<Exclude<PersistAnswer, "unsupported"> | null>(null);
  const [asking, setAsking] = useState(false);
  const backup = useBackup();
  const offline = useOfflineReady();

  useEffect(() => {
    let live = true;
    void readStorageStatus().then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, [savedAt]);

  async function ask() {
    setAsking(true);
    const result = await requestPersistence();
    setAsking(false);
    if (result !== "unsupported") setAnswer(result);
    setStatus(await readStorageStatus());
  }

  const kept = status?.persisted;
  return (
    <section aria-labelledby="storage-title" className={`${card} @container p-4 sm:p-5`} data-testid="storage-card">
      <div className="flex gap-3">
        <Icon name="database" className="mt-0.5 size-5 text-ink-3" />
        <div className="min-w-0 flex-1">
          <h2 id="storage-title" className={`${cardTitle} text-[15px]`}>
            {t("storage.title")}
          </h2>
          {status ? (
            <div className="mt-1.5 space-y-2 text-[13.5px] leading-relaxed text-pretty text-ink-2">
              <p data-testid="storage-usage">{status.usage === null ? t("storage.usageUnknown") : t("storage.usage", { size: formatBytes(status.usage) })}</p>
              <p className="flex gap-2" data-testid="storage-persisted">
                <Icon name={kept ? "shield" : "info"} className={`mt-[3px] size-4 ${kept ? "text-good" : kept === false ? "text-warn" : "text-ink-3"}`} />
                <span>{t(kept ? "storage.kept" : kept === false ? "storage.notKept" : "storage.keptUnknown")}</span>
              </p>
              {offline && (
                <p className="flex gap-2" data-testid="storage-offline">
                  <Icon name="check" className="mt-[3px] size-4 text-good" />
                  <span>{t("storage.offline")}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2" aria-hidden>
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          )}
        </div>
      </div>
      {status?.canAsk && (
        <button type="button" className={`mt-3.5 w-full ${button("secondary")}`} onClick={ask} disabled={asking}>
          <Icon name="shield" className="size-4" />
          {t("storage.ask")}
        </button>
      )}
      {/* Side by side only when the card itself is wide enough (on tablets it shares the row with the note card). */}
      <div className="mt-3.5 grid gap-2 @[26rem]:grid-cols-2">
        <button type="button" className={button("secondary")} onClick={backup.openExport} data-testid="storage-backup">
          <Icon name="download" className="size-4" />
          {t("storage.backup")}
        </button>
        <button type="button" className={button("secondary")} onClick={backup.openRestore} data-testid="storage-restore">
          <Icon name="backup" className="size-4" />
          {t("storage.restore")}
        </button>
      </div>
      <p role="status" aria-live="polite" className={answer ? `mt-3 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed text-pretty ${answer === "granted" ? "bg-good-soft text-good" : "bg-sunken text-ink-2"}` : "sr-only"}>
        {answer ? t(ANSWERS[answer]) : ""}
      </p>
      <div className="mt-3 space-y-2 border-t border-line pt-3 text-[12.5px] leading-relaxed text-pretty text-ink-3">
        <p>{t("storage.clearing")}</p>
        <p>{t("storage.backupNote")}</p>
      </div>
    </section>
  );
}
