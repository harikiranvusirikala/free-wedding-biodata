import type { DocModel } from "@/biodata/document";
import type { BlockSpec } from "./types";

/**
 * Every string a template's blocks print, in order: titles, labels, values (with notes) and paragraphs. Used by
 * the e2e check that the laid-out pages (and so the PDF) show all of it. Pure.
 */
export function blockTexts(specs: readonly BlockSpec[], doc: DocModel): string[] {
  const out: string[] = [];
  for (const { block } of specs) {
    switch (block.kind) {
      case "header":
        for (const text of [doc.invocation, doc.title, doc.name]) if (text) out.push(text);
        break;
      case "heading":
        out.push(block.title);
        break;
      case "row":
        if (block.row.label) out.push(block.row.label);
        out.push(block.row.value);
        if (block.row.note) out.push(block.row.note);
        break;
      case "paragraph":
        if (block.showLabel) out.push(block.paragraph.label);
        out.push(block.paragraph.text);
        break;
      case "lead":
        out.push(block.section.title);
        for (const item of block.section.items) {
          if (item.kind === "row") {
            if (item.label) out.push(item.label);
            out.push(item.value);
            if (item.note) out.push(item.note);
          } else out.push(item.text);
        }
        break;
      case "photo":
        break;
    }
  }
  return out;
}
