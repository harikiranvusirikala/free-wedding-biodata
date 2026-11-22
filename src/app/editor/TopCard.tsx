"use client";

import { memo, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { setInvocation, setMotif, setTitle, titleChoice } from "@/biodata/edits";
import { INVOCATIONS, INVOCATION_GROUPS, TITLE_KEYS, findInvocation } from "@/biodata/invocations";
import type { LangCode, ProfileOptions } from "@/biodata/types";
import { button, focusRing, iconButton, textLink } from "@/components/ui/button";
import { accentCard, accentTile, cardTitle } from "@/components/ui/card";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field as fieldClass, fieldHint } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { MOTIF_IDS, MOTIF_TRADITIONS, Motif, motifTradition } from "@/document/motifs";
import { getPalette, getTemplate } from "@/document/templates";
import type { Palette } from "@/document/tokens";
import { getDocDictionary } from "@/i18n/doc";
import { t, type AppKey } from "@/lib/i18n";
import en from "@/i18n/app/en.json";
import type { Edit } from "./FieldRow";

// "Top of your biodata" (BUILD_PLAN Step 2.0, VISION D21, D43, D45; mockup: editor), the form's first card: a
// symbol (our own drawings, as small tiles in the design's colours), an invocation line and a title. Each starts at
// None and nothing is ever chosen for the user or inferred from the Religion field. A picked line is copied in as
// text, so it can be edited and prints exactly as shown. Memoised on the options, so typing elsewhere doesn't
// re-render it.

export const TOP_ID = "top";

const hasKey = (key: string): key is AppKey => Object.hasOwn(en, key);
const motifName = (id: string) => t(`top.motif.${id}` as AppKey);

/** A row of radio buttons with arrow-key movement (Tab reaches the chosen one), as screen-reader users expect. */
function RadioTiles<T extends string>({
  labelId,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  labelId: string;
  value: T;
  options: readonly { value: T; label: string; title?: string; content: ReactNode; className: string; style?: CSSProperties; testId?: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
  className: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  function onKeyDown(event: KeyboardEvent) {
    const at = options.findIndex((o) => o.value === value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const to = step !== undefined ? (Math.max(at, 0) + step + options.length) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
    if (to < 0) return;
    event.preventDefault();
    onChange(options[to].value);
    group.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(options[to].value)}"]`)?.focus();
  }
  return (
    <div ref={group} role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown} className={className}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.title ?? option.label}
            data-value={option.value}
            data-testid={option.testId}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`${option.className} ${focusRing}`}
            style={option.style}
          >
            {option.content}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A symbol tile. The twenty choices (None and nineteen symbols, in tradition order) sit in four rows of five on phones
 * and two rows of ten from tablets up (no ragged last row); on phones a tile is 44 px tall, from tablets up it is
 * square, and the drawing takes most of it so the details stay readable.
 */
const TILE =
  "flex h-11 min-w-0 items-center justify-center rounded-[10px] border transition-[border-color,box-shadow] disabled:opacity-55 sm:aspect-square sm:h-auto aria-checked:border-brand aria-checked:ring-2 aria-checked:ring-ring [&_svg]:h-[78%] [&_svg]:w-[78%] sm:[&_svg]:h-[72%] sm:[&_svg]:w-[72%]";
const TILE_OFF = "border-line-strong hover:border-ink-3";

const CHIP =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-55 pointer-coarse:min-h-11 pointer-coarse:text-sm aria-checked:border-brand aria-checked:bg-brand-soft aria-checked:font-semibold aria-checked:text-brand-ink";
const CHIP_OFF = "border-line-strong bg-surface text-ink-2 shadow-card hover:bg-sunken";

/** A motif on a small piece of the design's paper. */
function MotifTile({ id, palette, size }: { id: string; palette: Palette; size: number }) {
  return <Motif id={id} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={size} />;
}

const traditionName = (id: string) => t(`top.group.${motifTradition(id)}` as AppKey);

/** The symbol tiles: None, then the whole library in its order (grouped by tradition), all at once. */
function MotifPicker({ value, palette, readOnly, onChange }: { value: string | null; palette: Palette; readOnly: boolean; onChange: (id: string | null) => void }) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const options = [
    {
      value: "none",
      label: t("top.motif.noneName"),
      content: <span className="text-[13px] font-semibold text-ink-2">{t("top.motif.none")}</span>,
      className: `${TILE} bg-surface ${value ? TILE_OFF : ""}`,
      testId: "motif-none",
    },
    ...MOTIF_IDS.map((id) => ({
      value: id,
      label: motifName(id),
      title: `${motifName(id)} · ${traditionName(id)}`,
      content: <MotifTile id={id} palette={palette} size={30} />,
      className: `${TILE} ${value === id ? "" : TILE_OFF}`,
      style: { background: palette.paper },
      testId: `motif-${id}`,
    })),
  ];
  return (
    <div className="px-4 py-3.5 sm:px-5" data-testid="top-motif">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 id={labelId} className="text-sm font-medium text-ink-2">
          {t("top.motif.label")}
        </h3>
        <button type="button" className={`inline-flex items-center pointer-coarse:min-h-11 text-[13px] ${textLink}`} onClick={() => setOpen(true)} disabled={readOnly}>
          {t("top.motif.all")}
        </button>
      </div>
      <RadioTiles
        labelId={labelId}
        value={value ?? "none"}
        options={options}
        onChange={(v) => onChange(v === "none" ? null : v)}
        disabled={readOnly}
        className="mt-2 grid max-w-[37rem] grid-cols-5 gap-1.5 sm:grid-cols-10"
      />
      <MotifDialog open={open} value={value} palette={palette} onClose={() => setOpen(false)} onChange={onChange} />
    </div>
  );
}

/** Every symbol larger, with its name, in groups by tradition ("See them larger"). Picking one closes it. */
function MotifDialog({ open, value, palette, onClose, onChange }: { open: boolean; value: string | null; palette: Palette; onClose: () => void; onChange: (id: string | null) => void }) {
  const pick = (id: string | null) => {
    onChange(id);
    onClose();
  };
  const cell = (selected: boolean) =>
    `flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition-colors ${selected ? "border-brand ring-2 ring-ring" : "border-line-strong hover:border-ink-3"} ${focusRing}`;
  const grid = "grid grid-cols-3 gap-2 sm:grid-cols-6";
  const groups = MOTIF_TRADITIONS.map((tradition) => ({ tradition, ids: MOTIF_IDS.filter((id) => motifTradition(id) === tradition) })).filter((group) => group.ids.length);
  return (
    <Dialog open={open} onClose={onClose} title={t("top.motif.dialog.title")} description={t("top.motif.dialog.text")} wide>
      <div className="space-y-4" data-testid="motif-dialog">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => pick(null)}
          className={`inline-flex min-h-12 items-center gap-2 rounded-xl border bg-surface px-4 transition-colors ${value === null ? "border-brand ring-2 ring-ring" : "border-line-strong hover:border-ink-3"} ${focusRing}`}
        >
          <span className="text-sm font-semibold text-ink-2">{t("top.motif.none")}</span>
          <span className="text-[13px] text-ink-3">{t("top.motif.noneName")}</span>
        </button>
        {groups.map(({ tradition, ids }) => (
          <section key={tradition} aria-label={t(`top.group.${tradition}` as AppKey)}>
            <h3 className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{t(`top.group.${tradition}` as AppKey)}</h3>
            <div className={grid}>
              {ids.map((id) => (
                <button key={id} type="button" aria-pressed={value === id} onClick={() => pick(id)} className={cell(value === id)} style={{ background: palette.paper }}>
                  <MotifTile id={id} palette={palette} size={60} />
                  <span className="text-[12.5px] leading-tight font-semibold" style={{ color: palette.label }}>
                    {motifName(id)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <DialogActions>
        <button type="button" className={button("secondary")} onClick={onClose}>
          {t("ui.close")}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** The invocation line: None, a common line (grouped by tradition) or the user's own; shown and editable as text. */
function InvocationPicker({ value, readOnly, onChange }: { value: string; readOnly: boolean; onChange: (text: string) => void }) {
  const selectId = useId();
  const inputId = useId();
  const hintId = useId();
  const [writing, setWriting] = useState(false);
  const preset = findInvocation(value);
  const choice = writing ? "own" : !value.trim() ? "none" : (preset?.id ?? "own");
  const focusInput = () => requestAnimationFrame(() => document.getElementById(inputId)?.focus());

  return (
    <div className="px-4 py-3.5 sm:px-5" data-testid="top-invocation">
      <label htmlFor={selectId} className="text-sm font-medium text-ink-2">
        {t("top.invocation.label")}
      </label>
      <select
        id={selectId}
        className={`mt-2 ${fieldClass} pr-8`}
        value={choice}
        disabled={readOnly}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "none") {
            setWriting(false);
            onChange("");
          } else if (next === "own") {
            setWriting(true);
            focusInput();
          } else {
            setWriting(false);
            onChange(INVOCATIONS.find((line) => line.id === next)?.text ?? "");
          }
        }}
      >
        <option value="none">{t("top.invocation.none")}</option>
        {INVOCATION_GROUPS.map((group) => (
          <optgroup key={group} label={t(`top.group.${group}` as AppKey)}>
            {INVOCATIONS.filter((line) => line.group === group).map((line) => {
              const key = `top.line.${line.id}`;
              const about = hasKey(key) ? t(key) : "";
              return (
                <option key={line.id} value={line.id}>
                  {about ? `${line.text}  ·  ${about}` : line.text}
                </option>
              );
            })}
          </optgroup>
        ))}
        <option value="own">{choice === "own" && value.trim() ? t("top.invocation.ownShort") : t("top.invocation.own")}</option>
      </select>
      {choice !== "none" && (
        <div className="mt-2.5">
          <label htmlFor={inputId} className="sr-only">
            {t("top.invocation.field")}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={inputId}
              className={`${fieldClass} font-medium`}
              value={value}
              placeholder={t("top.invocation.placeholder")}
              disabled={readOnly}
              aria-describedby={hintId}
              autoComplete="off"
              onChange={(event) => {
                setWriting(true);
                onChange(event.target.value);
              }}
            />
            <button
              type="button"
              className={`${iconButton} text-ink-3`}
              aria-label={t("top.invocation.clear")}
              title={t("top.invocation.clear")}
              disabled={readOnly}
              onClick={() => {
                setWriting(false);
                onChange("");
                requestAnimationFrame(() => document.getElementById(selectId)?.focus());
              }}
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
          <p id={hintId} className={`mt-1.5 ${fieldHint}`}>
            {t("top.invocation.hint")}
          </p>
        </div>
      )}
    </div>
  );
}

/** The title: None, a preset printed in the document language (D45), or the user's own words. */
function TitlePicker({ options, lang, readOnly, onChange }: { options: ProfileOptions; lang: LangCode; readOnly: boolean; onChange: (choice: ReturnType<typeof titleChoice>) => void }) {
  const labelId = useId();
  const inputId = useId();
  const hintId = useId();
  const choice = titleChoice(options);
  const english = getDocDictionary("en").titles;
  const printed = getDocDictionary(lang).titles;
  const value = choice.kind === "preset" ? choice.key : choice.kind;
  const chips = [
    { value: "none", label: t("top.titleChoice.none") },
    ...TITLE_KEYS.map((key) => ({ value: key as string, label: english[key] })),
    { value: "custom", label: t("top.titleChoice.own") },
  ].map((c) => ({ ...c, content: c.label, className: `${CHIP} ${c.value === value ? "" : CHIP_OFF}`, testId: `title-${c.value}` }));
  const presetPrinted = choice.kind === "preset" && lang !== "en" ? printed[choice.key as keyof typeof printed] : undefined;

  return (
    <div className="px-4 py-3.5 sm:px-5" data-testid="top-title">
      <h3 id={labelId} className="text-sm font-medium text-ink-2">
        {t("top.titleChoice.label")}
      </h3>
      <RadioTiles
        labelId={labelId}
        value={value}
        options={chips}
        disabled={readOnly}
        className="mt-2 flex flex-wrap gap-1.5"
        onChange={(next) => {
          if (next === "none") onChange({ kind: "none" });
          else if (next === "custom") {
            onChange({ kind: "custom", text: choice.kind === "custom" ? choice.text : "" });
            requestAnimationFrame(() => document.getElementById(inputId)?.focus());
          } else onChange({ kind: "preset", key: next });
        }}
      />
      {presetPrinted && (
        <p className={`mt-2 ${fieldHint}`} data-testid="title-prints-as">
          {t("top.titleChoice.prints", { text: presetPrinted })}
        </p>
      )}
      {choice.kind === "custom" && (
        <div className="mt-2.5">
          <label htmlFor={inputId} className="sr-only">
            {t("top.titleChoice.field")}
          </label>
          <input
            id={inputId}
            className={`${fieldClass} font-medium`}
            value={choice.text}
            placeholder={t("top.titleChoice.placeholder")}
            disabled={readOnly}
            aria-describedby={hintId}
            autoComplete="off"
            onChange={(event) => onChange({ kind: "custom", text: event.target.value })}
          />
          <p id={hintId} className={`mt-1.5 ${fieldHint}`}>
            {t("top.titleChoice.hint")}
          </p>
        </div>
      )}
    </div>
  );
}

/** What's chosen, in one line under the card's title. */
function summary(options: ProfileOptions, lang: LangCode): string {
  const parts: string[] = [];
  if (options.motif && MOTIF_IDS.includes(options.motif)) parts.push(motifName(options.motif));
  if (options.invocation.trim()) parts.push(options.invocation.trim());
  const title = titleChoice(options);
  if (title.kind === "preset") {
    const titles = getDocDictionary(lang).titles;
    parts.push(Object.hasOwn(titles, title.key) ? titles[title.key as keyof typeof titles] : title.key);
  } else if (title.kind === "custom" && title.text.trim()) parts.push(title.text.trim());
  if (!parts.length) return t("top.summary.none");
  if (options.motif) parts.push(t("top.summary.colour"));
  return parts.join(" · ");
}

export const TopCard = memo(function TopCard({
  options,
  lang,
  templateId,
  colorId,
  edit,
  readOnly,
}: {
  options: ProfileOptions;
  lang: LangCode;
  templateId: string;
  colorId: string;
  edit: Edit;
  readOnly: boolean;
}) {
  const palette = getPalette(getTemplate(templateId), colorId);
  const titleId = `section-${TOP_ID}-title`;
  return (
    <section id={`section-${TOP_ID}`} aria-labelledby={titleId} data-section={TOP_ID} className={`${accentCard} scroll-mt-20 max-lg:scroll-mt-[7.5rem]`}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center rounded-[10px] ${options.motif ? "" : accentTile}`}
          style={options.motif ? { background: palette.paper } : undefined}
          data-testid="top-preview"
        >
          {options.motif ? <MotifTile id={options.motif} palette={palette} size={34} /> : <Icon name="diya" className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} tabIndex={-1} className={`${cardTitle} outline-none`}>
            {t("top.title")}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-[13px] break-words text-ink-3" data-testid="top-summary">
            {summary(options, lang)}
          </p>
        </div>
      </div>
      <div className="divide-y divide-line">
        <InvocationPicker value={options.invocation} readOnly={readOnly} onChange={(text) => edit((p) => setInvocation(p, text))} />
        <MotifPicker value={options.motif} palette={palette} readOnly={readOnly} onChange={(id) => edit((p) => setMotif(p, id))} />
        <TitlePicker options={options} lang={lang} readOnly={readOnly} onChange={(choice) => edit((p) => setTitle(p, choice))} />
      </div>
    </section>
  );
});
