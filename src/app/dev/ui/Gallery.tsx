"use client";

import { useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ThemeMenu } from "@/components/ThemeMenu";
import { Dialog, DialogActions, dialogBox } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Menu, MenuLabel, MenuSeparator, dangerMenuItem, menuItem, menuPanel } from "@/components/ui/Menu";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingNote, Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Toast, toastAction } from "@/components/ui/Toast";
import { BADGE_TONES, badgeTone, type BadgeTone } from "@/components/ui/badge";
import { BUTTON_SIZES, BUTTON_VARIANTS, button, iconButton, outlineIconButton, textLink } from "@/components/ui/button";
import { card, cardBody, cardHeader, cardRow, cardRows, cardText, cardTitle, dangerCard, iconTile, noteCard } from "@/components/ui/card";
import { choice, choiceLabel, compactField, field, fieldError, fieldHint, fieldLabel, fieldSuccess, formError, formSuccess, textArea } from "@/components/ui/field";
import { GitHubMark, ICON_NAMES, Icon } from "@/components/ui/icons";
import { contentTitle, eyebrow, lead, pageTitle, pageWidth, prose, sectionTitle } from "@/components/ui/page";

// A development page, never shown to the public (a 404 on the live site), so its demo words are written here
// rather than in the app dictionary (BUILD_PLAN Part B rule 6 covers user-facing text).

/** One kind of component. Blocks flow in two columns on wide screens (CSS columns, so short ones pack). */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${card} ${cardBody} mb-5 flex min-w-0 break-inside-avoid flex-col gap-4`}>
      <h2 className="text-xs font-semibold tracking-[0.08em] text-ink-3 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-[13px] text-ink-3">{label}</span>}
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

const SIZES = [
  { value: "auto", label: "Auto" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL", disabled: true },
] as const;

export function Gallery() {
  const [dialog, setDialog] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("m");
  const [paper, setPaper] = useState<"a4" | "letter">("a4");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className={`${pageWidth} flex h-14 items-center`}>
          <Logo />
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </div>
      </header>

      <main className={`${pageWidth} py-10`}>
        <PageHeader
          title="UI kit"
          description="Every recipe and component in src/components/ui, in every state. Development only."
          actions={
            <>
              <button type="button" className={button("secondary")} onClick={() => setDialog(true)}>
                Open the dialog
              </button>
              <button type="button" className={button("primary")}>
                <Icon name="download" className="size-4" />
                Primary action
              </button>
            </>
          }
        />

        <div className="mt-8">
          <Block title="Buttons">
            {BUTTON_VARIANTS.map((variant) => (
              <Row key={variant} label={variant}>
                {BUTTON_SIZES.map((s) => (
                  <button key={s} type="button" className={button(variant, s)}>
                    {variant === "dangerOutline" || variant === "danger" ? <Icon name="trash" className="size-4" /> : <Icon name="edit" className="size-4" />}
                    Size {s}
                  </button>
                ))}
                <button type="button" disabled className={button(variant)}>
                  Disabled
                </button>
              </Row>
            ))}
            <Row label="Icon buttons (plain, menu open, outlined) and a text link">
              <button type="button" aria-label="Help" className={iconButton}>
                <Icon name="help" />
              </button>
              <button type="button" aria-label="Theme (open)" aria-expanded="true" className={iconButton}>
                <Icon name="moon" />
              </button>
              <button type="button" aria-label="Share" className={outlineIconButton}>
                <Icon name="share" />
              </button>
              <a href="#buttons" className={textLink}>
                A text link
              </a>
            </Row>
          </Block>
        </div>

        <div className="gap-5 lg:columns-2">
          <Block title="Type">
            <div className="space-y-4">
              <p className={eyebrow}>Eyebrow</p>
              <p className={contentTitle}>Content page title</p>
              <p className={pageTitle}>App page title</p>
              <p className={sectionTitle}>Section title</p>
              <p className={lead}>A lead sentence under a title, a little larger than the body text.</p>
              <div className={prose}>
                <p>
                  Body text with <b>a bold part</b>. Long words and Indic text wrap: శ్రీ కృష్ణమూర్తి, श्रीमती, ஸ்ரீ.
                </p>
              </div>
            </div>
          </Block>

          <Block title="Badges">
            <Row>
              {(Object.keys(BADGE_TONES) as BadgeTone[]).map((tone) => (
                <span key={tone} className={badgeTone(tone)}>
                  {tone}
                </span>
              ))}
              <span className={badgeTone("good")}>
                <Icon name="check" className="size-3.5" />
                Saved
              </span>
            </Row>
          </Block>

          <Block title="Cards">
            <div className={card}>
              <div className={cardHeader}>
                <h3 className={cardTitle}>Card with a header</h3>
                <span className={`ml-auto ${badgeTone("brand")}`}>3 rows</span>
              </div>
              <ul className={cardRows}>
                {["Name", "Date of birth", "Education"].map((row) => (
                  <li key={row} className={`${cardRow} text-sm text-ink-2`}>
                    <Icon name="file" className="size-4 text-ink-3" />
                    {row}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`${card} ${cardBody}`}>
                <span className={`${iconTile} bg-good-soft text-good`}>
                  <Icon name="lock" className="size-[18px]" />
                </span>
                <p className={`mt-3 ${cardTitle}`}>Plain card</p>
                <p className={`mt-1 ${cardText}`}>A sentence under the title.</p>
              </div>
              <div className={`${dangerCard} ${cardBody}`}>
                <p className={`${cardTitle} text-danger`}>Danger card</p>
                <p className={`mt-1 ${cardText}`}>For what can&apos;t be undone.</p>
                <button type="button" className={`mt-3 w-full ${button("dangerOutline")}`}>
                  <Icon name="trash" className="size-4" />
                  Delete all…
                </button>
              </div>
            </div>
            <p className={`${noteCard} text-sm text-ink-2`}>A note card: warm gold, for something worth knowing.</p>
          </Block>

          <Block title="Fields">
            <label className={fieldLabel}>
              Full name
              <input className={field} defaultValue="Sai Teja" aria-describedby="hint-name" />
              <span id="hint-name" className={fieldHint}>
                As it should be printed.
              </span>
            </label>
            <label className={fieldLabel}>
              Placeholder
              <input className={field} placeholder="e.g. Hyderabad" />
            </label>
            <label className={fieldLabel}>
              Height
              <input className={field} defaultValue="5 feet 13" aria-invalid="true" aria-describedby="err-height" />
              <span id="err-height" className={fieldError}>
                Inches go up to 11.
              </span>
            </label>
            <label className={fieldLabel}>
              Backup file
              <input className={field} defaultValue="biodata-backup.json" readOnly aria-describedby="ok-backup" />
              <span id="ok-backup" className={fieldSuccess}>
                The backup opened.
              </span>
            </label>
            <label className={fieldLabel}>
              Disabled
              <input className={field} defaultValue="Can't change" disabled />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className={fieldLabel}>
                Dropdown
                <select className={compactField} defaultValue="te">
                  <option value="en">English</option>
                  <option value="te">Telugu</option>
                  <option value="hi">Hindi</option>
                </select>
              </label>
              <label className={choiceLabel}>
                <input type="checkbox" className={choice} defaultChecked />
                Checkbox
              </label>
              <label className={choiceLabel}>
                <input type="radio" name="g-radio" className={choice} defaultChecked />
                Radio
              </label>
            </div>
            <label className={fieldLabel}>
              Several lines
              <textarea className={textArea} defaultValue="Calm, cheerful and close to my family." />
            </label>
            <p className={formError}>The file isn&apos;t a backup from this site.</p>
            <p className={formSuccess}>Saved on this device.</p>
          </Block>

          <Block title="Switch and segmented control">
            <div className="divide-y divide-line">
              <Switch checked={visible} onChange={setVisible} label="Show on the biodata" hint="Hidden fields stay in your draft." />
              <Switch checked={hidden} onChange={setHidden} label="Off" />
              <Switch checked disabled onChange={() => {}} label="Disabled (on)" />
            </div>
            <Row label="Text size (XL disabled)">
              <SegmentedControl label="Text size" value={size} options={SIZES} onChange={setSize} />
            </Row>
            <Row label="Paper">
              <SegmentedControl
                label="Paper"
                value={paper}
                options={[
                  { value: "a4", label: "A4" },
                  { value: "letter", label: "US Letter" },
                ]}
                onChange={setPaper}
              />
            </Row>
          </Block>

          <Block title="Menu">
            <Row label="Live: the theme menu and a menu with every kind of item">
              <ThemeMenu />
              <Menu label="Draft" button={<>Draft actions <Icon name="chevronDown" className="size-4" /></>} buttonClassName={button("secondary", "sm")} align="start">
                {(close) => (
                  <>
                    <MenuLabel>Sai Teja&apos;s biodata</MenuLabel>
                    <button type="button" role="menuitem" className={menuItem} onClick={close}>
                      <Icon name="edit" className="size-[18px]" />
                      Rename
                    </button>
                    <button type="button" role="menuitem" className={menuItem} disabled>
                      <Icon name="file" className="size-[18px]" />
                      Disabled item
                    </button>
                    <MenuSeparator />
                    <button type="button" role="menuitem" className={dangerMenuItem} onClick={close}>
                      <Icon name="trash" className="size-[18px]" />
                      Delete…
                    </button>
                  </>
                )}
              </Menu>
            </Row>
            <Row label="Still picture of an open menu">
              <div className={`${menuPanel} w-56`}>
                <MenuLabel>Theme</MenuLabel>
                <div className={menuItem}>
                  <Icon name="sun" className="size-[18px]" />
                  <span className="flex-1">Day</span>
                </div>
                <div className={`${menuItem} bg-sunken font-semibold text-ink`}>
                  <Icon name="moon" className="size-[18px]" />
                  <span className="flex-1">Night</span>
                  <Icon name="check" className="size-[18px] text-brand-ink" />
                </div>
                <div className={menuItem}>
                  <Icon name="monitor" className="size-[18px]" />
                  <span className="flex-1">Follow device</span>
                </div>
              </div>
            </Row>
          </Block>

          <Block title="Dialog">
            <Row label="Live">
              <button type="button" className={button("secondary")} onClick={() => setDialog(true)}>
                Open the dialog
              </button>
            </Row>
            <span className="text-[13px] text-ink-3">Still picture</span>
            <div className={`${dialogBox} p-5 sm:p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight">Delete this draft?</p>
                  <p className="mt-1 text-sm text-ink-3">Sai Teja&apos;s biodata and its photo are removed from this browser.</p>
                </div>
                <span className={`${iconButton} -mt-1.5 -mr-2`}>
                  <Icon name="x" />
                </span>
              </div>
              <DialogActions>
                <span className={button("secondary")}>Cancel</span>
                <span className={button("danger")}>Delete</span>
              </DialogActions>
            </div>
          </Block>

          <Block title="Toasts">
            <div className="flex flex-col items-start gap-2.5">
              <Toast>Draft renamed.</Toast>
              <Toast tone="good">
                Backup downloaded.
                <button type="button" className={toastAction}>
                  Show
                </button>
              </Toast>
              <Toast tone="danger" role="alert">
                Couldn&apos;t save: this browser is out of space.
              </Toast>
            </div>
          </Block>

          <Block title="Skeleton and empty state">
            <div className={`${card} ${cardBody} flex items-center gap-4`} aria-busy="true">
              <LoadingNote />
              <Skeleton className="h-14 w-11 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            </div>
            <div className={`${card} py-8`}>
              <EmptyState
                icon="file"
                title="No drafts yet"
                actions={
                  <button type="button" className={button("primary")}>
                    <Icon name="plus" className="size-4" />
                    New biodata
                  </button>
                }
              >
                Your drafts appear here, saved in this browser.
              </EmptyState>
            </div>
          </Block>

        </div>

        <div>
          <Block title="Icons">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {ICON_NAMES.map((name) => (
                <li key={name} className="flex flex-col items-center gap-1.5 rounded-lg border border-line px-1 py-3 text-ink-2">
                  <Icon name={name} />
                  <span className="text-[11px] text-ink-3">{name}</span>
                </li>
              ))}
              <li className="flex flex-col items-center gap-1.5 rounded-lg border border-line px-1 py-3 text-ink-2">
                <GitHubMark />
                <span className="text-[11px] text-ink-3">GitHubMark</span>
              </li>
            </ul>
          </Block>
        </div>
      </main>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Rename this draft" description="Only you see this name; it isn't printed.">
        <label className={fieldLabel}>
          Name
          <input className={field} defaultValue="Sai Teja's biodata" />
        </label>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={() => setDialog(false)}>
            Cancel
          </button>
          <button type="button" className={button("primary")} onClick={() => setDialog(false)}>
            Rename
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
