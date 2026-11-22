"use client";

import { memo, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DocModel } from "@/biodata/document";
import { activeStylePreset, setColor, setDateFormat, setDesign, setDocLanguage, setLabelCase, setLabelStyle, setStylePreset, setTextSize } from "@/biodata/edits";
import { EXAMPLE_DATE, formatDate, parseIsoDate } from "@/biodata/format";
import type { DateFormat, LabelStyle, LangCode, ProfileOptions, TextSize } from "@/biodata/types";
import { getPalette, getTemplate, TEMPLATES, type TemplateDef } from "@/document/templates";
import type { Palette } from "@/document/tokens";
import { getDocDictionary } from "@/i18n/doc";
import { button, focusRing } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { t, type AppKey } from "@/lib/i18n";
import type { Edit } from "../FieldRow";
import { LanguageDialog, languageName } from "../LanguageNotice";
import { PAGE_HEIGHT, PAGE_WIDTH, SIZE_LABELS, sizeHint, type SizeStep } from "./layout-math";

// The live preview's controls (BUILD_PLAN Step 3.3, VISION §5 "Preview toolbar", D31, D39, D45, D46): the design
// (every design as a small thumbnail drawn with each design's own frame and colours), its three colours, the printing
// language (the same dialog as the language notice), the text size (Auto or XS–XL, saying which size Auto chose and
// whether it fits one page) and the label case. Every choice is a pure edit (src/biodata/edits.ts) through the
// editor's one `edit()`, so it autosaves like typing.

export interface LayoutInfo {
  /** The biodata's own pages (what the text-size hint is about). */
  pages: number;
  step: SizeStep;
  /** Pages after the biodata (Step 4.2b): extra photo pages and the horoscope chart's page. */
  photoPages: number;
  chartPages: number;
}

const tile = `rounded-xl outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring`;

/** Arrow keys (and Home, End) move through a group of role="radio" buttons and choose, as a radio group does. */
function radioKeys(event: KeyboardEvent<HTMLElement>) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  const radios = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])')];
  if (!radios.length) return;
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  const to = step !== undefined ? (at + step + radios.length) % radios.length : event.key === "Home" ? 0 : event.key === "End" ? radios.length - 1 : -1;
  if (to < 0) return;
  event.preventDefault();
  radios[to].focus();
  radios[to].click();
}

/**
 * A design as a small page: its paper and frame artwork (the same component the document draws), with headings,
 * rows and the photo sketched in its colours inside its real margins. Decorative: the button around it names it.
 */
export const DesignThumb = memo(function DesignThumb({ template, palette, doc, width }: { template: TemplateDef; palette: Palette; doc: DocModel; width: number }) {
  const scale = width / PAGE_WIDTH;
  const box = template.pageBox(0, doc);
  const contentWidth = PAGE_WIDTH - box.left - box.right;
  const bar = palette.bar !== "transparent" ? palette.bar : undefined;
  const rule = palette.barRule ?? palette.rule;
  const parts: ReactNode[] = [];
  let y = box.top + 8;
  const bottom = PAGE_HEIGHT - box.bottom - 30;
  for (let s = 0; y < bottom; s++) {
    parts.push(
      bar ? (
        <span key={`h${s}`} style={{ position: "absolute", left: box.left, top: y, width: contentWidth * (s === 0 && template.skeleton !== "modern" ? 0.66 : 1), height: 34, background: bar }} />
      ) : (
        <span key={`h${s}`} style={{ position: "absolute", left: box.left, top: y + 26, width: contentWidth * 0.45, height: 6, background: rule }} />
      ),
    );
    if (s === 0 && template.skeleton !== "modern") {
      parts.push(<span key="photo" style={{ position: "absolute", right: box.right, top: y, width: contentWidth * 0.3, height: contentWidth * 0.4, borderRadius: 10, background: palette.soft ?? palette.inkBase }} />);
    }
    y += 56;
    const rows = s === 0 ? 7 : 4;
    for (let r = 0; r < rows && y < bottom; r++) {
      const narrow = s === 0 && template.skeleton !== "modern" ? 0.62 : 1;
      parts.push(<span key={`l${s}-${r}`} style={{ position: "absolute", left: box.left + 14, top: y, width: contentWidth * 0.2 * narrow + 30, height: 11, borderRadius: 6, background: palette.label, opacity: 0.75 }} />);
      parts.push(<span key={`v${s}-${r}`} style={{ position: "absolute", left: box.left + contentWidth * 0.32 * narrow + 40, top: y, width: contentWidth * (0.28 + ((r * 7 + s * 3) % 5) * 0.05) * narrow, height: 11, borderRadius: 6, background: palette.text, opacity: 0.32 }} />);
      y += 27;
    }
    y += 34;
  }
  return (
    <span aria-hidden className="relative block shrink-0 overflow-hidden rounded-[3px] shadow-[0_1px_3px_rgb(0_0_0/0.18)]" style={{ width, height: Math.round(PAGE_HEIGHT * scale) }}>
      <span className="absolute top-0 left-0 block origin-top-left" style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, background: palette.paper }}>
        {template.Frame ? <template.Frame palette={palette} /> : null}
        {parts}
      </span>
    </span>
  );
});

/** The colour each design's thumbnail shows: the chosen colour for the open design, its first colour otherwise. */
const thumbPalette = (template: TemplateDef, doc: DocModel) => (template.id === getTemplate(doc.templateId).id ? getPalette(template, doc.colorId) : template.colors[0]);

function pickDesign(edit: Edit, template: TemplateDef) {
  edit((p) => (getTemplate(p.templateId).id === template.id ? p : setDesign(p, template.id, template.colors[0].id)));
}

/** The open design's three colours as swatches (D39), named for screen readers; `labelled` shows the names too. */
export function ColourPicker({ doc, edit, disabled, labelled = false }: { doc: DocModel; edit: Edit; disabled?: boolean; labelled?: boolean }) {
  const template = getTemplate(doc.templateId);
  const current = getPalette(template, doc.colorId);
  return (
    <div role="radiogroup" aria-label={t("preview.colour")} onKeyDown={radioKeys} className={`flex ${labelled ? "flex-wrap gap-1.5" : "gap-1"}`} data-testid="colour-picker">
      {template.colors.map((palette) => {
        const checked = palette.id === current.id;
        return (
          <button
            key={palette.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={t("preview.colourOption", { name: palette.name })}
            title={palette.name}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            data-colour={palette.id}
            onClick={() => edit((p) => setColor(p, palette.id))}
            className={
              labelled
                ? `inline-flex h-9 items-center gap-2 rounded-full border px-3 pr-3.5 text-[13px] font-medium pointer-coarse:min-h-11 ${checked ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-ink-2 hover:bg-sunken"} ${focusRing} disabled:opacity-55`
                : `flex size-9 items-center justify-center rounded-full pointer-coarse:size-11 ${focusRing} disabled:opacity-55`
            }
          >
            <span
              aria-hidden
              className={`block rounded-full ${labelled ? "size-4" : "size-7"} ${checked && !labelled ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : "ring-1 ring-black/15"}`}
              style={{ background: palette.swatch }}
            />
            {labelled && palette.name}
          </button>
        );
      })}
    </div>
  );
}

/** Every design as a grid of thumbnails (desktop picker) or a scrolling strip (the phone sheet, mockup sheet-phone). */
export function DesignChoices({ doc, edit, disabled, layout, onPicked }: { doc: DocModel; edit: Edit; disabled?: boolean; layout: "grid" | "strip"; onPicked?: () => void }) {
  const currentId = getTemplate(doc.templateId).id;
  const width = layout === "grid" ? 62 : 60;
  return (
    <div
      role="radiogroup"
      aria-label={t("preview.designs")}
      onKeyDown={radioKeys}
      className={layout === "grid" ? "grid grid-cols-5 gap-x-1.5 gap-y-2" : "-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] sm:-mx-5 sm:scroll-px-5 sm:px-5"}
      data-testid="design-choices"
    >
      {TEMPLATES.map((template) => {
        const checked = template.id === currentId;
        return (
          <button
            key={template.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            data-design={template.id}
            onClick={() => {
              pickDesign(edit, template);
              onPicked?.();
            }}
            className={`group flex shrink-0 snap-start flex-col items-center gap-1.5 p-1.5 ${tile} ${checked ? "bg-brand-soft" : "hover:bg-sunken"} disabled:opacity-55`}
            style={{ width: width + 12 }}
          >
            <span className={`rounded-[5px] p-0.5 ${checked ? "ring-2 ring-brand" : "ring-1 ring-transparent group-hover:ring-line-strong"}`}>
              <DesignThumb template={template} palette={thumbPalette(template, doc)} doc={doc} width={width} />
            </span>
            <span className={`line-clamp-3 text-center text-[11.5px] leading-tight ${checked ? "font-semibold text-brand-ink" : "text-ink-2"}`}>{template.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Desktop: "Classic Gold ▾" opens the designs and the colours (mockup: editor's preview toolbar). */
export function DesignPopover({ doc, edit, disabled }: { doc: DocModel; edit: Edit; disabled?: boolean }) {
  const template = getTemplate(doc.templateId);
  const palette = getPalette(template, doc.colorId);
  return (
    <Popover
      label={t("preview.design")}
      testId="design-panel"
      buttonLabel={t("preview.designButton", { name: template.name, colour: palette.name })}
      buttonClassName={`${button("secondary")} w-full min-w-0 justify-start px-3 aria-expanded:bg-sunken`}
      disabled={disabled}
      // Twenty designs make the panel taller than a short laptop screen: it scrolls, so the colours stay reachable.
      panelClassName="max-h-[calc(100dvh-11rem)] w-[24.5rem] overflow-y-auto overscroll-contain"
      button={
        <>
          <span aria-hidden className="size-4 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: palette.swatch }} />
          <span className="min-w-0 flex-1 truncate text-left">{template.name}</span>
          <Icon name="chevronDown" className="size-4 text-ink-3" />
        </>
      }
    >
      {
        <div className="space-y-3">
          <p className="px-0.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{t("preview.designs")}</p>
          <DesignChoices doc={doc} edit={edit} layout="grid" />
          <div className="border-t border-line pt-3">
            <p className="mb-2 px-0.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{t("preview.colour")}</p>
            <ColourPicker doc={doc} edit={edit} labelled />
          </div>
        </div>
      }
    </Popover>
  );
}

const SIZE_OPTIONS: readonly { value: TextSize; label: string }[] = [
  { value: "auto", label: t("preview.textSize.auto") },
  ...(Object.entries(SIZE_LABELS) as [SizeStep, string][]).map(([value, label]) => ({ value, label })),
];

/** "Fits on one page at size M" (green) or "Takes 2 pages…" (D31, D45). */
export function FitHint({ textSize, layout }: { textSize: TextSize; layout: LayoutInfo | null }) {
  if (!layout) return <p className="min-h-5 text-[13px] text-ink-3">{t("preview.loading")}</p>;
  const hint = sizeHint(textSize, layout);
  const one = layout.pages <= 1;
  return (
    <p className={`flex min-h-5 items-center gap-1.5 text-[13px] font-medium ${one ? "text-good" : "text-ink-2"}`} data-testid="fit-hint" aria-live="polite">
      <Icon name={one ? "check" : "file"} className="size-4" />
      {t(hint.key, hint.values)}
    </p>
  );
}

const heading = "mb-2 px-0.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase";
const note = "mt-2 px-0.5 text-[12.5px] text-pretty text-ink-3";

/**
 * "Style: Standard | Telugu families": one tap sets the label wording and the date style that go together (D14,
 * D28). Two toggle buttons rather than a radio group, because a draft whose wording and dates were set one by one
 * matches neither (neither is pressed then, and both stay reachable by keyboard).
 */
export function StylePreset({ options, edit, disabled }: { options: Pick<ProfileOptions, "labelStyle" | "dateFormat">; edit: Edit; disabled?: boolean }) {
  const active = activeStylePreset(options);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label={t("preview.style")}>
        <span className="px-0.5 text-[13px] font-semibold text-ink">{t("preview.style")}:</span>
        <div className="inline-grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-sunken p-0.5 ring-1 ring-line ring-inset" data-testid="style-preset">
          {(["standard", "telugu"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={active === preset}
              disabled={disabled}
              data-preset={preset}
              onClick={() => edit((p) => setStylePreset(p, preset))}
              className={`h-8 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-45 motion-reduce:transition-none pointer-coarse:min-h-11 ${
                active === preset ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:text-ink"
              }`}
            >
              {t(`preview.style.${preset}` as const)}
            </button>
          ))}
        </div>
      </div>
      <p className={note}>{t("preview.style.hint")}</p>
    </div>
  );
}

/** Label wording (Standard | Telugu families): changes English headings only, so other languages can't pick it. */
export function WordingControl({ doc, labelStyle, edit, disabled }: { doc: DocModel; labelStyle: LabelStyle; edit: Edit; disabled?: boolean }) {
  const latin = doc.lang === "en";
  const noteId = useId();
  const options = (["standard", "telugu"] as const).map((value) => ({ value, label: t(`preview.wording.${value}` as const), disabled: disabled || !latin }));
  return (
    <div>
      <p className={heading}>{t("preview.wording")}</p>
      <SegmentedControl label={t("preview.wording")} value={labelStyle} options={options} onChange={(v) => edit((p) => setLabelStyle(p, v))} className="w-full" describedBy={noteId} />
      <p id={noteId} className={note}>
        {latin ? t("preview.wording.hint") : t("preview.wording.englishOnly", { language: languageName(doc.lang) })}
      </p>
    </div>
  );
}

const DATE_OPTIONS: readonly { value: DateFormat; caption: AppKey }[] = [
  { value: "dd-mm-yyyy", caption: "preview.dates.dd-mm-yyyy" },
  { value: "d month yyyy", caption: "preview.dates.d month yyyy" },
  { value: "d-month-yyyy", caption: "preview.dates.d-month-yyyy" },
];

/**
 * How dates print: three choices, each shown as the date would look (the draft's own date of birth when it has
 * one, else 13 January 1998), with the month in the printing language. Applies to every date in the biodata.
 */
export function DatesControl({ doc, dateFormat, exampleDate, edit, disabled }: { doc: DocModel; dateFormat: DateFormat; exampleDate?: string; edit: Edit; disabled?: boolean }) {
  const dict = getDocDictionary(doc.lang);
  const noteId = useId();
  const iso = exampleDate && parseIsoDate(exampleDate) ? exampleDate : EXAMPLE_DATE;
  return (
    <div>
      <p className={heading}>{t("preview.dates")}</p>
      <div role="radiogroup" aria-label={t("preview.dates")} aria-describedby={noteId} onKeyDown={radioKeys} className="space-y-1.5" data-testid="date-formats">
        {DATE_OPTIONS.map(({ value, caption }) => {
          const checked = value === dateFormat;
          const example = formatDate(iso, value, dict);
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={t("preview.dates.option", { example, name: t(caption) })}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              data-date-format={value}
              onClick={() => edit((p) => setDateFormat(p, value))}
              className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg border px-3 py-1 text-left pointer-coarse:min-h-11 ${focusRing} disabled:opacity-55 ${
                checked ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong text-ink-2 hover:bg-sunken"
              }`}
            >
              <span lang={doc.lang} className={`min-w-0 text-[14px] ${checked ? "font-semibold" : "font-medium text-ink"}`}>
                {example}
              </span>
              <span className="shrink-0 text-[12px] text-ink-3">{t(caption)}</span>
            </button>
          );
        })}
      </div>
      <p id={noteId} className={note}>
        {t("preview.dates.hint")}
      </p>
    </div>
  );
}

/** What the text controls read from the draft. */
export type StyleOptions = Pick<ProfileOptions, "textSize" | "labelCase" | "labelStyle" | "dateFormat">;

interface TextControlsProps {
  doc: DocModel;
  options: StyleOptions;
  /** The draft's own date, for the date examples. */
  exampleDate?: string;
  layout: LayoutInfo | null;
  edit: Edit;
  disabled?: boolean;
  /** The phone/tablet sheet: one row each, the fit sentence shown beside the colours instead. */
  sheet?: boolean;
}

/**
 * Text size (Auto, XS–XL), the label case (D31), the label wording and the date style. Desktop: one panel, with the
 * one-tap Style line first. The sheet keeps size and case on one row and opens the rest in a dialog, "Labels and
 * dates" (the sheet has no room for them beside the pages).
 */
export function TextControls({ doc, options, exampleDate, layout, edit, disabled, sheet = false }: TextControlsProps) {
  const [more, setMore] = useState(false);
  const latin = doc.lang === "en";
  const sizes = SIZE_OPTIONS.map((o) => ({ ...o, disabled }));
  const cases = [
    { value: "normal" as const, label: t("preview.labels.normal"), disabled: disabled || !latin },
    { value: "upper" as const, label: t("preview.labels.upper"), disabled: disabled || !latin },
  ];
  const sizeControl = <SegmentedControl label={t("preview.textSize")} value={options.textSize} options={sizes} onChange={(v) => edit((p) => setTextSize(p, v))} className="w-full" />;
  const caseControl = <SegmentedControl label={t("preview.labels")} value={options.labelCase} options={cases} onChange={(v) => edit((p) => setLabelCase(p, v))} className={sheet ? "" : "w-full"} />;
  const style = <StylePreset options={options} edit={edit} disabled={disabled} />;
  const wording = <WordingControl doc={doc} labelStyle={options.labelStyle ?? "standard"} edit={edit} disabled={disabled} />;
  const dates = <DatesControl doc={doc} dateFormat={options.dateFormat} exampleDate={exampleDate} edit={edit} disabled={disabled} />;
  if (sheet) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 sm:flex-1">{sizeControl}</div>
          <div className="flex items-center justify-between gap-2.5 sm:justify-end">
            <span className="text-[13px] text-ink-3">{t("preview.labels")}</span>
            {caseControl}
          </div>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setMore(true)}
          className={`-mx-1 inline-flex h-10 items-center justify-between gap-2 rounded-lg px-1 text-[14px] font-medium text-ink-2 hover:text-ink pointer-coarse:min-h-11 ${focusRing}`}
        >
          {t("preview.moreStyle")}
          <Icon name="chevronRight" className="size-4 text-ink-3" />
        </button>
        <Dialog open={more} onClose={() => setMore(false)} title={t("preview.moreStyle")} description={t("preview.moreStyle.text")}>
          <div className="space-y-4" data-testid="sheet-more-style">
            {style}
            <div className="border-t border-line pt-4">{wording}</div>
            <div className="border-t border-line pt-4">{dates}</div>
          </div>
          <DialogActions>
            <button type="button" className={button("primary")} onClick={() => setMore(false)}>
              {t("language.done")}
            </button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {style}
      <div className="border-t border-line pt-2.5">
        <p className={heading}>{t("preview.textSize")}</p>
        {sizeControl}
        <div className="mt-2 px-0.5">
          <FitHint textSize={options.textSize} layout={layout} />
          <p className="mt-1 text-[12.5px] text-pretty text-ink-3">{t("preview.textSize.hint")}</p>
        </div>
      </div>
      <div className="border-t border-line pt-2.5">
        <p className={heading}>{t("preview.labels")}</p>
        {caseControl}
        {!latin && <p className={note}>{t("preview.labels.latinOnly")}</p>}
      </div>
      <div className="border-t border-line pt-2.5">{wording}</div>
      <div className="border-t border-line pt-2.5">{dates}</div>
    </div>
  );
}

/** "Auto · M" or "Size L": the text size in use, Auto naming the size it chose. */
export function textSizeValue(textSize: TextSize, layout: LayoutInfo | null): string {
  if (textSize !== "auto") return t("preview.textSize.fixed", { size: SIZE_LABELS[textSize] });
  return layout ? t("preview.textSize.autoChosen", { size: SIZE_LABELS[layout.step] }) : t("preview.textSize.auto");
}

/** Desktop: "T Auto · M ▾" opens the text size, label and date controls. */
export function TextSizePopover(props: Omit<TextControlsProps, "sheet">) {
  const value = textSizeValue(props.options.textSize, props.layout);
  return (
    <Popover
      label={t("preview.panel")}
      testId="text-size-panel"
      align="end"
      buttonLabel={t("preview.textSize.button", { value })}
      buttonClassName={`${button("secondary")} w-full min-w-0 justify-start px-3 aria-expanded:bg-sunken`}
      disabled={props.disabled}
      panelClassName="max-h-[calc(100dvh-11rem)] w-[21rem] overflow-y-auto overscroll-contain"
      button={
        <>
          <Icon name="type" className="size-4 text-ink-3" />
          <span data-testid="text-size-value" className="min-w-0 flex-1 truncate text-left">
            {value}
          </span>
          <Icon name="chevronDown" className="size-4 text-ink-3" />
        </>
      }
    >
      <TextControls {...props} />
    </Popover>
  );
}

/** The printing language: a button naming it, opening the same dialog as the language notice (Step 2.0). */
export function LanguageButton({ lang, edit, disabled, className }: { lang: LangCode; edit: Edit; disabled?: boolean; className: string }) {
  const [open, setOpen] = useState(false);
  const own = getDocDictionary(lang).meta.name;
  return (
    <>
      <button type="button" className={className} aria-label={t("preview.language", { language: languageName(lang) })} disabled={disabled} onClick={() => setOpen(true)}>
        <Icon name="globe" className="size-4 text-ink-3" />
        <span lang={lang} className="min-w-0 flex-1 truncate text-left">
          {own}
        </span>
        <Icon name="chevronDown" className="size-4 text-ink-3" />
      </button>
      <LanguageDialog open={open} lang={lang} onClose={() => setOpen(false)} onPick={(next) => edit((p) => setDocLanguage(p, next))} />
    </>
  );
}
