// The app's buttons (BUILD_PLAN A7), for <button> and <a> alike: plain class strings, as in the sibling apps,
// so server components use them too. Every colour is a design token (globals.css), so Night needs no twin.
// Every control is at least 44 px tall on touch screens (pointer-coarse:min-h-11, VISION D16).

/** The soft ring a keyboard user sees on whatever has the focus. */
export const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

const BASE = `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 pointer-coarse:min-h-11 ${focusRing}`;

const VARIANTS = {
  /** The one main action on a screen (Create my biodata, Download). */
  primary: "bg-brand text-on-brand shadow-brand hover:bg-brand-hover",
  /** Everything else that matters: outlined. */
  secondary: "border border-line-strong bg-surface text-ink shadow-card hover:bg-sunken",
  /** Quiet: in toolbars and beside a primary button. */
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  /** Confirms something that can't be taken back, inside its confirmation. */
  danger: "bg-danger text-on-danger shadow-card hover:opacity-90",
  /** Opens that confirmation (Delete all…). */
  dangerOutline: "border border-danger-line bg-surface text-danger shadow-card hover:bg-danger-soft",
};

const SIZES = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;
export const BUTTON_VARIANTS = Object.keys(VARIANTS) as ButtonVariant[];
export const BUTTON_SIZES = Object.keys(SIZES) as ButtonSize[];

export function button(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

/** A square button holding only an icon (its accessible name comes from aria-label); shaded while its menu is open. */
export const iconButton = `inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-sunken hover:text-ink disabled:opacity-55 aria-expanded:bg-sunken aria-expanded:text-ink pointer-coarse:size-11 ${focusRing}`;

/** The same with a border, beside outlined buttons. */
export const outlineIconButton = `inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-2 shadow-card transition-colors hover:bg-sunken hover:text-ink disabled:opacity-55 aria-expanded:bg-sunken pointer-coarse:size-11 ${focusRing}`;

/** A link inside text or under a card: brand-coloured, underlined on hover. */
export const textLink = `rounded-sm font-semibold text-brand-ink underline-offset-4 hover:underline ${focusRing}`;
