// The designs as plain data (Step 6.1): id, name, kind and colour swatches, in picker order, for pages that only
// list them (the landing page, the gallery, the editor's ?design= check). The registry (./index.ts) pulls in every
// design's drawing code, which server components can't import; catalog.test.ts keeps this list equal to it.

export interface DesignSummary {
  id: string;
  name: string;
  skeleton: "classic" | "modern" | "minimal";
  colors: readonly { id: string; name: string; swatch: string }[];
}

export const DESIGN_CATALOG: readonly DesignSummary[] = [
  { id: "classic-gold", name: "Classic Gold", skeleton: "classic", colors: [{ id: "gold", name: "Gold", swatch: "#fcc96a" }, { id: "rose", name: "Rose", swatch: "#f2b8a0" }, { id: "sage", name: "Sage", swatch: "#cfe3c3" }] },
  { id: "kalyanam", name: "Kalyanam", skeleton: "classic", colors: [{ id: "maroon", name: "Maroon", swatch: "#7a1420" }, { id: "saffron", name: "Saffron", swatch: "#c2410c" }, { id: "leaf", name: "Leaf", swatch: "#3f7d3a" }] },
  { id: "temple-bells", name: "Temple Bells", skeleton: "classic", colors: [{ id: "maroon", name: "Maroon", swatch: "#8a1c2b" }, { id: "amber", name: "Amber", swatch: "#b45309" }, { id: "blue", name: "Temple blue", swatch: "#1f4e79" }] },
  { id: "rangoli", name: "Rangoli", skeleton: "classic", colors: [{ id: "rose", name: "Rose", swatch: "#c2507a" }, { id: "violet", name: "Violet", swatch: "#7c3aed" }, { id: "marigold", name: "Marigold", swatch: "#e08a1e" }] },
  { id: "paisley", name: "Paisley", skeleton: "classic", colors: [{ id: "copper", name: "Copper", swatch: "#b5651d" }, { id: "maroon", name: "Maroon", swatch: "#8a1c2b" }, { id: "teal", name: "Teal", swatch: "#2f6a5b" }] },
  { id: "royal-maroon", name: "Royal Maroon", skeleton: "classic", colors: [{ id: "maroon", name: "Maroon", swatch: "#7d1426" }, { id: "purple", name: "Royal purple", swatch: "#4c1d95" }, { id: "wine", name: "Wine", swatch: "#3b1219" }] },
  { id: "deepam", name: "Deepam", skeleton: "classic", colors: [{ id: "maroon", name: "Festive maroon", swatch: "#3b0a14" }, { id: "purple", name: "Festive purple", swatch: "#2e1065" }, { id: "night", name: "Night", swatch: "#111827" }] },
  { id: "baroque-gold", name: "Baroque Gold", skeleton: "classic", colors: [{ id: "gold", name: "Parchment gold", swatch: "#c9a24f" }, { id: "maroon", name: "Maroon", swatch: "#7d1426" }, { id: "navy", name: "Festive navy", swatch: "#14213d" }] },
  { id: "sandalwood", name: "Sandalwood", skeleton: "classic", colors: [{ id: "sandal", name: "Sandal", swatch: "#c99a5b" }, { id: "rosewood", name: "Rosewood", swatch: "#b0705c" }, { id: "tulsi", name: "Tulsi", swatch: "#8c9a5a" }] },
  { id: "peacock", name: "Peacock", skeleton: "classic", colors: [{ id: "teal", name: "Teal", swatch: "#0f6e74" }, { id: "blue", name: "Royal blue", swatch: "#1e3a8a" }, { id: "emerald", name: "Festive emerald", swatch: "#0f2f25" }] },
  { id: "floral-ivory", name: "Floral Ivory", skeleton: "classic", colors: [{ id: "blush", name: "Blush", swatch: "#e889a3" }, { id: "lavender", name: "Lavender", swatch: "#a78bfa" }, { id: "marigold", name: "Marigold", swatch: "#f59e0b" }] },
  { id: "watercolour-rose", name: "Watercolour Rose", skeleton: "classic", colors: [{ id: "rose", name: "Rose", swatch: "#c2507a" }, { id: "lilac", name: "Lilac", swatch: "#9d7bd8" }, { id: "coral", name: "Coral", swatch: "#e38b5c" }] },
  { id: "mango-grove", name: "Mango Grove", skeleton: "classic", colors: [{ id: "mango", name: "Mango", swatch: "#c8691c" }, { id: "leaf", name: "Leaf green", swatch: "#6a8f2e" }, { id: "berry", name: "Berry", swatch: "#b8456b" }] },
  { id: "mint-vines", name: "Mint Vines", skeleton: "classic", colors: [{ id: "green", name: "Green", swatch: "#3f7d3a" }, { id: "teal", name: "Teal", swatch: "#0f766e" }, { id: "olive", name: "Olive", swatch: "#6b8e23" }] },
  { id: "peach-filigree", name: "Peach Filigree", skeleton: "classic", colors: [{ id: "peach", name: "Peach", swatch: "#e9a98a" }, { id: "rose", name: "Rose", swatch: "#d9879f" }, { id: "sage", name: "Sage", swatch: "#9aab72" }] },
  { id: "executive-navy", name: "Executive Navy", skeleton: "modern", colors: [{ id: "navy", name: "Navy", swatch: "#14284b" }, { id: "forest", name: "Forest", swatch: "#1f4e3d" }, { id: "plum", name: "Plum", swatch: "#3d2b56" }] },
  { id: "modern-two-column", name: "Modern Two-Column", skeleton: "modern", colors: [{ id: "teal", name: "Teal", swatch: "#127a6c" }, { id: "amber", name: "Amber", swatch: "#b45309" }, { id: "rose", name: "Rose", swatch: "#be123c" }] },
  { id: "slate-brush", name: "Slate Brush", skeleton: "modern", colors: [{ id: "slate", name: "Slate", swatch: "#5b7083" }, { id: "heather", name: "Heather", swatch: "#7c6a9a" }, { id: "sage", name: "Sage", swatch: "#7a8b6f" }] },
  { id: "navy-rosette", name: "Navy Rosette", skeleton: "classic", colors: [{ id: "navy", name: "Navy", swatch: "#1f3c73" }, { id: "maroon", name: "Maroon", swatch: "#7d1426" }, { id: "green", name: "Forest green", swatch: "#14532d" }] },
  { id: "minimal-ivory", name: "Minimal Ivory", skeleton: "minimal", colors: [{ id: "ink", name: "Ink", swatch: "#1d1d1b" }, { id: "maroon", name: "Maroon", swatch: "#7a1420" }, { id: "navy", name: "Navy", swatch: "#1f3c73" }] },
];
