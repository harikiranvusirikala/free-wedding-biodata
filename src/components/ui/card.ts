// Cards (BUILD_PLAN A7): white panels on the page's warm grey, a 1 px border and a soft shadow; Night's
// surfaces come from the same tokens. Plain class strings, like button.ts.

export const card = "rounded-2xl border border-line bg-surface shadow-card";

/** A card's inside when it has no header: 16 px, 20 from tablets up. */
export const cardBody = "p-4 sm:p-5";

/** A card for what can't be taken back: deleting. */
export const dangerCard = "rounded-2xl border border-danger-line bg-surface shadow-card";

/** A card's title row, above its rows. */
export const cardHeader = "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 sm:px-5";

export const cardTitle = "text-base font-semibold tracking-tight text-ink";

/** A sentence under a card's title. */
export const cardText = "text-sm text-pretty text-ink-3";

/** A card's list, one row per item. */
export const cardRows = "divide-y divide-line";

/** A row in cardRows. */
export const cardRow = "flex items-center gap-3 px-4 py-3 sm:px-5";

/** A highlighted note inside text (Keep your drafts safe): warm gold, not a warning. */
export const noteCard = "rounded-xl border border-gold/25 bg-gold-soft px-4 py-3.5 sm:px-5 sm:py-4";

/** A square tile holding a card's icon. */
export const iconTile = "flex size-9 shrink-0 items-center justify-center rounded-[10px]";

/**
 * An editor card (Top of your biodata, Photo, each section): a card with a thin maroon → gold strip along its top
 * (Step 2.5, D51). Only these carry it; small cards, notes and dialogs stay plain.
 */
export const accentCard = `${card} accent-strip`;

/** The colours of a card-header icon tile (with iconTile, or a larger tile's own size): the soft brand → gold wash. */
export const accentTile = "bg-tile text-brand-ink ring-1 ring-brand/10 ring-inset";
