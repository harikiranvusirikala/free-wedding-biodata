import type { Palette } from "../tokens";
import { baroqueGold } from "./baroque-gold";
import { classicGold } from "./classic-gold";
import { deepam } from "./deepam";
import { executiveNavy } from "./executive-navy";
import { floralIvory } from "./floral-ivory";
import { kalyanam } from "./kalyanam";
import { mangoGrove } from "./mango-grove";
import { minimalIvory } from "./minimal-ivory";
import { mintVines } from "./mint-vines";
import { modernTwoColumn } from "./modern-two-column";
import { navyRosette } from "./navy-rosette";
import { paisley } from "./paisley";
import { peachFiligree } from "./peach-filigree";
import { peacock } from "./peacock";
import { rangoli } from "./rangoli";
import { royalMaroon } from "./royal-maroon";
import { sandalwood } from "./sandalwood";
import { slateBrush } from "./slate-brush";
import { templeBells } from "./temple-bells";
import type { TemplateDef } from "./types";
import { watercolourRose } from "./watercolour-rose";

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
  baroqueGold,
  sandalwood,
  peacock,
  floralIvory,
  watercolourRose,
  mangoGrove,
  mintVines,
  peachFiligree,
  executiveNavy,
  modernTwoColumn,
  slateBrush,
  navyRosette,
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
