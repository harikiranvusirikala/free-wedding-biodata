import type { Palette } from "../tokens";
import { classicGold } from "./classic-gold";
import { minimalIvory } from "./minimal-ivory";
import type { TemplateDef } from "./types";

// Every design (VISION D46), in picker order. Steps 4.3 and 4.4 add the rest. An id that no longer exists (an
// old draft, a removed design) falls back to the first design at render time; the draft itself is never changed.

export const TEMPLATES: readonly TemplateDef[] = [classicGold, minimalIvory];

export const DEFAULT_TEMPLATE = classicGold;

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? DEFAULT_TEMPLATE;
}

/** The template's colour variant, or its first (default) variant for an unknown id. */
export function getPalette(template: TemplateDef, colorId: string): Palette {
  return template.colors.find((c) => c.id === colorId) ?? template.colors[0];
}

export type { TemplateDef, BlockViewProps } from "./types";
