// Badges (BUILD_PLAN A7): small rounded labels for a state ("Saved", "Hidden", "New"). Status colours:
// green for saved, amber for warnings, red for danger, the brand for what's chosen. Plain class strings.

export const badge = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

export const BADGE_TONES = {
  neutral: "bg-sunken text-ink-3",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export type BadgeTone = keyof typeof BADGE_TONES;

export function badgeTone(tone: BadgeTone = "neutral"): string {
  return `${badge} ${BADGE_TONES[tone]}`;
}
