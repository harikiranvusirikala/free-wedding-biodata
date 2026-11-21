// The app's form fields (BUILD_PLAN A7): 36 px like the buttons (44 on touch), the label above, a hint
// below, then an error or success message. Touch screens get 16 px text from globals.css, so iPhones don't
// zoom in. Plain class strings, like button.ts.

const BASE =
  "rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-ring disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70 aria-invalid:border-danger aria-invalid:focus:ring-danger/25";

/** A one-line field or a dropdown, as wide as its column. */
export const field = `h-9 w-full ${BASE} pointer-coarse:min-h-11`;

/** The same, only as wide as what it holds: a dropdown in a row. */
export const compactField = `h-9 ${BASE} pointer-coarse:min-h-11`;

/** Several lines (About me, address). */
export const textArea = `block min-h-20 w-full py-2 leading-relaxed ${BASE}`;

/** A label above its field (wrap both, or point htmlFor at the field). */
export const fieldLabel = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/** A line under a field, saying what it's for (linked with aria-describedby). */
export const fieldHint = "text-[13px] font-normal text-ink-3";

/** What's wrong with a field, under it (also linked with aria-describedby). */
export const fieldError = "text-[13px] font-medium text-danger";

/** A field that worked out (a backup that opened). */
export const fieldSuccess = "text-[13px] font-medium text-good";

/** Checkboxes and radio buttons, in the brand colour. */
export const choice = "size-4 shrink-0 accent-brand";

/** A checkbox or radio beside its words. */
export const choiceLabel = "flex items-center gap-2 text-sm text-ink-2 pointer-coarse:min-h-11";

/** A message under a form: what went wrong. */
export const formError = "rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger";

/** A message under a form: it worked. */
export const formSuccess = "rounded-lg border border-good/25 bg-good-soft px-3 py-2.5 text-sm text-good";
