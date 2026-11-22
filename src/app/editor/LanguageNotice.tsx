"use client";

import { memo, useState } from "react";
import { setDocLanguage } from "@/biodata/edits";
import { LANG_CODES, type LangCode } from "@/biodata/types";
import { button, focusRing, textLink } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/icons";
import { getDocDictionary } from "@/i18n/doc";
import { t, type AppKey } from "@/lib/i18n";
import type { Edit } from "./FieldRow";

// The language notice under the top card (BUILD_PLAN Step 2.0, VISION D11, D23, D43; mockup: editor): which
// language the headings print in, and that what you type prints as typed. Change opens the ten document languages,
// each named in its own script, with "not yet checked by a native speaker" on drafted dictionaries (D11, D47).
// The editor itself stays English; only the printed page changes.

const englishName = (lang: LangCode) => t(`language.${lang}` as AppKey);

/** "తెలుగు (Telugu)", or just "English". */
function languageName(lang: LangCode): string {
  const own = getDocDictionary(lang).meta.name;
  return lang === "en" ? own : `${own} (${englishName(lang)})`;
}

export const LanguageNotice = memo(function LanguageNotice({ lang, edit, readOnly }: { lang: LangCode; edit: Edit; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [before, after] = t("language.notice").split("{language}");
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken/70 py-2 pr-2 pl-3.5 text-[13.5px] text-ink-2 sm:pl-4" data-testid="language-notice">
      <Icon name="globe" className="size-4 shrink-0 text-ink-3" />
      <p className="min-w-0 flex-1 py-1 text-pretty">
        {before}
        <b className="font-semibold text-ink">{languageName(lang)}</b>
        {after}
      </p>
      <button
        type="button"
        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[13.5px] pointer-coarse:min-h-11 ${textLink}`}
        aria-label={t("language.changeLabel")}
        disabled={readOnly}
        onClick={() => setOpen(true)}
      >
        {t("language.change")}
      </button>
      <LanguageDialog open={open} lang={lang} onClose={() => setOpen(false)} onPick={(next) => edit((p) => setDocLanguage(p, next))} />
    </div>
  );
});

function LanguageDialog({ open, lang, onClose, onPick }: { open: boolean; lang: LangCode; onClose: () => void; onPick: (lang: LangCode) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={t("language.dialog.title")} description={t("language.dialog.text")} wide>
      <div role="radiogroup" aria-label={t("language.dialog.title")} className="grid gap-2 sm:grid-cols-2" data-testid="language-options">
        {LANG_CODES.map((code) => {
          const dict = getDocDictionary(code);
          const checked = code === lang;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={checked}
              lang={code}
              data-lang={code}
              onClick={() => onPick(code)}
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${checked ? "border-brand bg-brand-soft ring-2 ring-ring" : "border-line-strong hover:bg-sunken"} ${focusRing}`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] leading-snug font-semibold ${checked ? "text-brand-ink" : "text-ink"}`}>{dict.meta.name}</span>
                <span lang="en" className="block text-[12.5px] leading-snug text-ink-3">
                  {code === "en" ? "" : englishName(code)}
                  {!dict.meta.reviewed && <span className="block">{t("language.unreviewed")}</span>}
                </span>
              </span>
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${checked ? "border-brand bg-brand text-on-brand" : "border-line-strong"}`}
              >
                {checked && <Icon name="check" className="size-3 [stroke-width:3]" />}
              </span>
            </button>
          );
        })}
      </div>
      <DialogActions>
        <button type="button" className={button("primary")} onClick={onClose}>
          {t("language.done")}
        </button>
      </DialogActions>
    </Dialog>
  );
}
