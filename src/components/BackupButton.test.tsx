import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DownloadOutcome } from "@/lib/backup-file";
import { BackupButton } from "./BackupButton";

const resolved = (outcome: DownloadOutcome) => vi.fn(() => Promise.resolve(outcome));

describe("BackupButton", () => {
  it("says what it saves, works, then says what it downloaded", async () => {
    let finish: (outcome: DownloadOutcome) => void = () => undefined;
    const run = vi.fn(() => new Promise<DownloadOutcome>((resolve) => (finish = resolve)));
    render(<BackupButton run={run} hint="Saves this draft in a file you keep." />);
    expect(screen.getByText("Saves this draft in a file you keep.")).toBeTruthy();

    const button = screen.getByRole("button", { name: "Download a backup first" });
    fireEvent.click(button);
    expect((await screen.findByRole("button", { name: "Making your backup…" })).hasAttribute("disabled")).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);

    finish({ ok: true, name: "Biodata-backup-2026-11-22.json", bytes: 340_000, count: 2, unreadable: 0 });
    const status = await screen.findByText(/Backup downloaded: Biodata-backup-2026-11-22\.json, 340 kB/);
    expect(status.getAttribute("role")).toBe("status");
    expect(status.textContent).toContain("keep it somewhere safe");
    expect(status.textContent).not.toMatch(/guarantee|safe and sound|can never be lost/i);
    expect(screen.getByRole("button", { name: "Download a backup first" }).hasAttribute("disabled")).toBe(false);
  });

  it("announces why nothing was downloaded", async () => {
    render(<BackupButton run={resolved({ ok: false, kind: "empty" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Download a backup first" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("There are no drafts to back up yet.");
  });

  it("treats a thrown error as a failure instead of leaving the button spinning", async () => {
    render(<BackupButton run={() => Promise.reject(new Error("boom"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Download a backup first" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("couldn't be made"));
    expect(screen.getByRole("button", { name: "Download a backup first" }).hasAttribute("disabled")).toBe(false);
  });

  it("mentions drafts that couldn't be opened, and uses the message it is given", async () => {
    render(<BackupButton run={resolved({ ok: true, name: "b.json", bytes: 1200, count: 1, unreadable: 2 })} label="Download a backup" doneKey="save.quota.backupDone" />);
    fireEvent.click(screen.getByRole("button", { name: "Download a backup" }));
    const status = await screen.findByText(/includes the changes that aren't saved yet/);
    expect(status.textContent).toContain("2 that can't be opened aren't in it.");
  });
});
