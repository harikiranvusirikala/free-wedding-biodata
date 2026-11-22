"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AutosaveController } from "@/lib/autosave";
import type { OpenDraftState } from "@/lib/backup-file";
import type { ProfileRepo } from "@/lib/profile-repo";
import { ExportBackupDialog } from "./ExportBackupDialog";
import { RestoreBackupDialog } from "./RestoreBackupDialog";

// Where backups open from (BUILD_PLAN Step 5.1): the drafts menu, the storage card and the privacy page's links
// (`/editor?backup=download` and `?backup=restore`, which open the same dialogs on arrival). One place holds the two
// dialogs, so each opens the same way from everywhere.

type Which = "export" | "restore";

interface BackupActions {
  openExport(): void;
  openRestore(): void;
  /** The open draft as the editor holds it now, for backups made while a save can't go through. */
  getOpen(): OpenDraftState;
  repo: ProfileRepo;
}

const BackupContext = createContext<BackupActions | null>(null);

export function useBackup(): BackupActions {
  const actions = useContext(BackupContext);
  if (!actions) throw new Error("useBackup must be used inside <BackupProvider>");
  return actions;
}

/** `?backup=download` or `?backup=restore` in the address: a link from another page asking for a dialog. */
function requested(): Which | null {
  if (typeof window === "undefined") return null;
  const want = new URL(window.location.href).searchParams.get("backup");
  return want === "download" ? "export" : want === "restore" ? "restore" : null;
}

export function BackupProvider({ controller, repo, children }: { controller: AutosaveController; repo: ProfileRepo; children: ReactNode }) {
  const [dialog, setDialog] = useState<Which | null>(requested);

  // The request is used once: take it out of the address, so a reload doesn't open the dialog again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("backup")) return;
    url.searchParams.delete("backup");
    window.history.replaceState(null, "", url);
  }, []);

  const getOpen = useCallback((): OpenDraftState => ({ profile: controller.getSnapshot().profile, pendingPhotos: controller.pendingPhotos() }), [controller]);
  const actions = useMemo<BackupActions>(
    () => ({ openExport: () => setDialog("export"), openRestore: () => setDialog("restore"), getOpen, repo }),
    [getOpen, repo],
  );

  return (
    <BackupContext.Provider value={actions}>
      {children}
      <ExportBackupDialog open={dialog === "export"} onClose={() => setDialog(null)} repo={repo} getOpen={getOpen} />
      <RestoreBackupDialog open={dialog === "restore"} onClose={() => setDialog(null)} repo={repo} controller={controller} />
    </BackupContext.Provider>
  );
}
