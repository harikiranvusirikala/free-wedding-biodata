import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

const TONES = {
  neutral: { icon: null, colour: "" },
  good: { icon: "check", colour: "text-good" },
  danger: { icon: "alert", colour: "text-danger" },
} satisfies Record<string, { icon: IconName | null; colour: string }>;

export type ToastTone = keyof typeof TONES;

/**
 * A short message that floats in ("Backup downloaded.", "Draft deleted." with Undo): a raised card with a
 * deep shadow, so it stands out over the page in Day and Night. A status, so screen readers say it (pass
 * role="alert" for an error); its parent places it and decides when it goes. Slides in unless the device
 * asks for less motion.
 */
export function Toast({ children, tone = "neutral", role = "status", className = "" }: { children: ReactNode; tone?: ToastTone; role?: "status" | "alert"; className?: string }) {
  const { icon, colour } = TONES[tone];
  return (
    <div role={role} className={`pointer-events-auto flex w-fit max-w-[calc(100vw-2rem)] animate-menu-in items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-pop motion-reduce:animate-none ${className}`}>
      {icon && <Icon name={icon} className={`size-[18px] ${colour}`} />}
      {children}
    </div>
  );
}

/** A toast's action (Undo). */
export const toastAction =
  "-my-1 rounded-md px-1.5 py-1 font-semibold text-brand-ink outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:min-h-11";
