// Page frames and type (BUILD_PLAN A7): the content width, eyebrows, titles and body text that every screen
// shares, so a new page looks like the others without choosing sizes again. Plain class strings.

/** The content width: 1152 px, with 16/24/32 px at the sides. */
export const pageWidth = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/** A small uppercase line above a title ("Privacy", "Help"). */
export const eyebrow = "text-xs font-bold tracking-[0.12em] text-brand-ink uppercase";

/** An app page's title (PageHeader): 24 px, 28 from tablets up. */
export const pageTitle = "text-2xl leading-tight font-bold tracking-tight text-ink text-balance sm:text-[28px]";

/** A content page's title (/help, /privacy), larger as in the mockups: 30 px, 38 from tablets up. */
export const contentTitle = "text-[30px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink text-balance sm:text-[38px]";

/** The sentence under a content page's title. */
export const lead = "text-base leading-relaxed text-pretty text-ink-2 sm:text-[17px]";

/** A section title inside a content page. */
export const sectionTitle = "text-xl font-bold tracking-tight text-ink sm:text-[21px]";

/** Body text in a content page: 15 px, 16 from tablets up, with room between lines. */
export const prose = "space-y-3 text-[15px] leading-relaxed text-pretty break-words text-ink-2 sm:text-base [&_b]:font-semibold [&_b]:text-ink";
