import type { Palette } from "../tokens";
import { classicGold } from "./classic-gold";
import { deepam } from "./deepam";
import { executiveNavy } from "./executive-navy";
import { kalyanam } from "./kalyanam";
import { minimalIvory } from "./minimal-ivory";
import { modernTwoColumn } from "./modern-two-column";
import { paisley } from "./paisley";
import { rangoli } from "./rangoli";
import { royalMaroon } from "./royal-maroon";
import { templeBells } from "./temple-bells";
import type { TemplateDef } from "./types";

// Every design (VISION D46), in picker order (D46's list; Step 4.4 adds designs 11–20 in their places, Minimal Ivory
// stays last). An id that no longer exists (an old draft, a removed design) falls back to the first design at render
// time; the draft itself is never changed.

export const TEMPLATES: readonly TemplateDef[] = [
  classicGold,
  kalyanam,
  templeBells,
  rangoli,
  paisley,
  royalMaroon,
  deepam,
  executiveNavy,
  modernTwoColumn,
  minimalIvory,
];

export const DEFAULT_TEMPLATE = classicGold;

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}

/** The template's colour variant, or its first (default) variant for an unknown id. */
export function getPalette(template: TemplateDef, colorId: string): Palette {
  return template.colors.find((c) => c.id === colorId) ?? template.colors[0];
}

export type { TemplateDef, BlockViewProps, AsideProps } from "./types";
