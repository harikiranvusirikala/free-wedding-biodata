import en from "@/i18n/app/en.json";

// The app's words (BUILD_PLAN Part B rule 6, VISION D23): every user-facing string in a component comes from
// src/i18n/app/<locale>.json through t(). English only at launch; a translation, when one is reviewed, may
// leave keys out and they fall back to English. Printed biodata labels are a separate set (src/i18n/doc/).
// Pure: server components, client components and tests all call it.

export type AppKey = keyof typeof en;
export type AppLocale = "en";

const DICTIONARIES: Record<AppLocale, Partial<Record<AppKey, string>>> = { en };

/** The app's language. Only English until a translation is reviewed (the app-language setting comes then). */
export const APP_LOCALE: AppLocale = "en";

/**
 * The text for `key`, with `{name}`-style placeholders filled from `values`. A placeholder with no value is
 * left as it is, so a missing one shows up in screenshots rather than vanishing.
 */
export function t(key: AppKey, values?: Record<string, string | number>, locale: AppLocale = APP_LOCALE): string {
  const text = DICTIONARIES[locale][key] ?? en[key];
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
