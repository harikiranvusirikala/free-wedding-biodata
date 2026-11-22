import type { DocModel, DocRow, DocSection } from "@/biodata/document";
import { sectionItemSpecs } from "../../blocks/sections";
import type { BlockSpec } from "../../blocks/types";
import { SIDE_PANEL_WIDTH } from "../../frames/SidePanel";
import { hasTopElement } from "../../templates/classic-gold/layout";
import { minimalSubtitle } from "../../templates/minimal-ivory/layout";
import type { PhotoOptions } from "../../templates/types";
import type { Box } from "../../tokens";

// The Modern skeleton's block list and margins (VISION D34, D46: Executive Navy, Modern Two-Column). PURE.
// Page 1 has a coloured side panel holding the photo, the name (with designation · city under it) and, when it is
// short enough, the Contact section; it is fixed artwork, not paginated (the template's Aside). Everything else
// flows in the main column to the right of the panel. The panel is drawn on every page, so the main column has the
// same width and position on every page and the shared paginate() applies unchanged: continuation pages simply
// continue the main column.

/** The main column: right of the side panel with a gap, the same on every page. */
export const MODERN_BOX: Box = { top: 56, right: 48, bottom: 56, left: SIDE_PANEL_WIDTH + 40 };

/** Inside the side panel: horizontal padding and the space above and below its content. */
export const SIDE_PAD = { x: 26, top: 48, bottom: 40 } as const;

/**
 * The Contact section goes in the side panel only when it surely fits beside the photo and name at the largest
 * text size: at most 7 rows and 360 characters, no paragraphs. A longer one stays in the main column.
 */
export const SIDE_CONTACT_LIMIT = { rows: 7, chars: 360 } as const;

/**
 * With the second photo low in the panel (Step 4.4, D40) the Contact section has less room: at most 4 rows and 200
 * characters stay in the panel, a longer one goes to the main column.
 */
export const SIDE_CONTACT_LIMIT_TWO_PHOTOS = { rows: 4, chars: 200 } as const;

/** More space between sections than Classic: no bars, so the white space separates them. */
export const MODERN_SECTION_SPACE = 1.5;

export function modernPageBox(): Box {
  return MODERN_BOX;
}

const rowChars = (r: DocRow) => r.label.length + r.value.length + (r.note?.length ?? 0);

/** The Contact section when it goes in the side panel, else undefined. */
export function sideContact(doc: DocModel, { secondPhoto = false }: Partial<PhotoOptions> = {}): DocSection | undefined {
  const section = doc.sections.find((s) => s.key === "contact");
  if (!section || !section.items.length) return undefined;
  const limit = secondPhoto ? SIDE_CONTACT_LIMIT_TWO_PHOTOS : SIDE_CONTACT_LIMIT;
  const rows = section.items.filter((i): i is DocRow => i.kind === "row");
  if (rows.length !== section.items.length || rows.length > limit.rows) return undefined;
  return rows.reduce((n, r) => n + rowChars(r), 0) <= limit.chars ? section : undefined;
}

/** The line under the name in the panel: designation (or occupation) · work city (or current city). */
export const modernSubtitle = minimalSubtitle;

export function modernBlocks(doc: DocModel, options: Partial<PhotoOptions> = {}): BlockSpec[] {
  const out: BlockSpec[] = [];
  if (hasTopElement(doc)) out.push({ block: { kind: "header", id: "header" }, spaceBefore: 0 });
  const contact = sideContact(doc, options);
  for (const section of doc.sections) {
    if (section === contact) continue;
    // The name heads the side panel, so its row isn't repeated in the main column.
    const items = doc.name ? section.items.filter((i) => !(i.kind === "row" && i.key === "fullName")) : section.items;
    if (!items.length) continue;
    out.push({
      block: { kind: "heading", id: `${section.id}:heading`, title: section.title },
      spaceBefore: out.length ? MODERN_SECTION_SPACE : 0,
      keepWithNext: true,
    });
    out.push(...sectionItemSpecs(items));
  }
  return out;
}

/** Every string the side panel prints, in order. */
export function modernAsideTexts(doc: DocModel, options: Partial<PhotoOptions> = {}): string[] {
  const out: string[] = [];
  if (doc.name) out.push(doc.name);
  const subtitle = modernSubtitle(doc);
  if (subtitle) out.push(subtitle);
  const contact = sideContact(doc, options);
  if (contact) {
    out.push(contact.title);
    for (const item of contact.items) {
      if (item.kind !== "row") continue;
      if (item.label) out.push(item.label);
      out.push(item.value);
      if (item.note) out.push(item.note);
    }
  }
  return out;
}
