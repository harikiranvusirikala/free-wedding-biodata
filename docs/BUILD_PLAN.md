# Free Wedding Biodata — Build Plan

**Product:** [VISION.md](VISION.md) (§ numbers and decisions D1… below refer to it) · **Started:** 2026-11-20

This file says **how** the app is built: architecture (Part A), rules every step follows (Part B), the steps (Part C) and the Progress table (Part D). Status lives only in the Progress table. Each step ends with its checks passing and a commit straight to `main`; the next step then starts without waiting (owner's choice, 2026-11-20, see Part B rules 9–10). Phase 0 is detailed now; later steps are outlines that are detailed in this file, in the same commit as the code, as each one starts.

**Look and feel:** `docs/mockups/` (local only, git-ignored, owner's choice 2026-11-20) shows every page (landing, editor on desktop and phone in Day and Night, phone preview, templates, help, privacy) and the Classic Gold biodata, drawn with a fictional profile; `bash docs/mockups/tools/render.sh` re-renders them. Once the owner agrees them, steps that build a screen match its mockup and record any deliberate change in the step notes. Only real screenshots of the built app are committed (`docs/screenshots/`, Step 6.1).

**Milestone M1 (VISION D29): the owner makes their own biodata with the app**, matching their reference PDF (`docs/references/`, git-ignored) in the Classic Gold template, and downloads it. M1 is reached at the end of Step 4.1; the steps up to it build exactly what that biodata needs first.

---

# Part A — Architecture

## A1. Stack (VISION §12, decided 2026-11-20)

- **Next.js 16** (App Router, Turbopack) with **`output: 'export'`**: `next build` writes a static `out/` folder. No route handlers, server actions, `proxy.ts`, `headers()`, cookies or default image loader (unsupported in static export, and not wanted). Don't enable `cacheComponents`.
- **React 19**, **TypeScript** strict, **Tailwind CSS v4** wired like the sibling apps (`@tailwindcss/turbopack` loader in `next.config.ts`, no PostCSS config).
- **zod 4** (profile, database reads, backup import), **Dexie** (IndexedDB), `fake-indexeddb` (unit tests only).
- **PDF:** decided by Step 0.2. Expected: **`harfbuzzjs`** (text shaping, WebAssembly) + **`pdf-lib`** (PDF writing), both lazy-loaded on the first download. Print through `window.print()`.
- **Fonts:** Noto Sans static TTFs (OFL 1.1) copied into `public/fonts/` by `npm run fonts` from an npm package that ships TTFs (candidate `@expo-google-fonts/noto-sans-*`; confirmed in Step 0.2).
- **No** UI library, icon package, form library, state library, drag-and-drop library, PWA plugin, backend, auth or AI SDK (D5–D7). **Analytics:** Google Tag Manager on public pages only, Production only (D22); no `/admin`, no counting backend (D24).
- **Pictures:** `npm run images` (`scripts/site-images.mts`, using `sharp`, which comes with Next.js) builds icons, the link preview, GitHub's social preview and the landing WebPs (D27).
- **Tests:** Vitest (+ Testing Library, jsdom) and Playwright (installed Google Chrome locally, `channel: "chrome"`; CI installs Chromium).
- **Hosting:** Vercel Hobby, framework preset Next.js, serving `out/`. Security headers and CSP in `vercel.json` (D15). CI on GitHub Actions.

## A2. Folder layout

```text
src/app/
  layout.tsx                 root: <html lang>, theme script, fonts CSS, metadataBase
  page.tsx                   landing: create / continue, privacy promise        Steps 1.1, 1.4, 6.1
  editor/page.tsx            editor + preview; draft from ?d=<id>               Steps 1.3–4.1
  templates/page.tsx         template gallery (real previews from sample data)  Step 6.1
  help/page.tsx, privacy/page.tsx                                               Steps 1.1, 6.1
  dev/…                      dev-only pages (pdf spike, fixtures); 404 unless ENABLE_DEV_PAGES=1 or next dev
  manifest.ts, robots.ts, sitemap.ts, icon.svg, apple-icon.png, opengraph-image.png
src/biodata/                 PURE logic, no browser APIs, fully unit-tested
  types.ts, schema.ts        profile types (A3) and zod schema
  defaults.ts                default sections and fields (§6, D28), fictional sample profile
  edits.ts                   every profile change as a pure function (D6)
  migrate.ts                 schemaVersion migrations (database and backups share them)
  document.ts                profile + dictionary + today → DocModel (omits empty/hidden, age, dates)
  format.ts                  dates, time, height, filename sanitising
  backup.ts                  backup file build/parse (D8)
src/document/                the shared render contract (A4)
  tokens.ts                  page size, margins, type scale, spacing, colours per template
  paginate.ts                PURE: measured blocks → pages
  Page.tsx, blocks/…         document primitives used by every template
  templates/<id>/            one folder per template (8, §7)
  motifs/                    original SVG motif artwork (D21)
src/pdf/                     the Download engine chosen in Step 0.2 (lazy-loaded)
src/lib/                     browser services (thin, mockable)
  site.ts                    product name ("Free Wedding Biodata"), URL (https://free-wedding-biodata.vercel.app), TITLE/DESCRIPTION source (D37), SUPPORT_URL, robotsFor/sitemapFor (Production-only indexing) (D17, D25, D26)
  tag-manager.ts             PURE gtmId(env): GTM_ID if it looks like GTM-…, else nothing (D22)
  db.ts                      Dexie database, versions, upgrade functions
  profile-repo.ts            the single persistence service (A5)
  autosave.ts                debounce, flush on visibilitychange/route change, revision checks
  photos.ts                  decode, downscale, crop drawing (D12)
  storage-status.ts          persist() and estimate()
  i18n.ts                    dictionary loading, English fallback
  settings-store.ts          theme, app language (localStorage)
src/i18n/
  doc/<lang>.json            document labels (D11), ten languages
  app/en.json                app UI strings, English only at launch (D23)
src/components/ui/           small design kit (Button, Dialog, Field, Select, Switch, Toast)
src/components/landing/      landing parts; content.ts holds TITLE, DESCRIPTION, FAQ, structuredData(), GOOGLE_SITE_VERIFICATION (D26)
src/components/GoogleTagManager.tsx   GTM snippets, rendered only by the public pages' layout (D22)
src/components/editor/, preview/, backup/
public/fonts/                Noto TTFs + OFL.txt (generated by npm run fonts, committed)
public/sw.js                 hand-written service worker (Step 5.2)
scripts/*.mts                fonts, images (site-images.mts), serve-out; run with node --import tsx
test/                        setup, fixtures (ten-language profiles, long-content profile)
e2e/                         Playwright specs
docs/brand/app-icon.svg      the approved app icon (VISION D48), source for every icon size
docs/screenshots/            README and landing pictures (copied from e2e screenshots)
docs/social-preview.png      GitHub's social preview (npm run images)
docs/PROJECT_GUIDE.md        beginner's guide to the code (D27)
docs/mockups/                pre-build look of every page (HTML + PNG; local only, git-ignored)
docs/spikes/                 Phase 0 evidence (PDFs, page images, report)
```

Public pages (`/`, `/templates`, `/help`, `/privacy`) sit in a `(public)` route group whose layout renders `GoogleTagManager`; `/editor` is outside it.

## A3. Data model (`src/biodata/types.ts`, VISION §18 refined)

```ts
export type FieldType = "text" | "textarea" | "date" | "time" | "select" | "height" | "phone" | "email";

export interface Field {
  id: string;            // crypto.randomUUID(), stable forever
  key?: string;          // default fields only, e.g. "dateOfBirth"; gives the dictionary label
  label?: string;        // set when the user renames; otherwise the label comes from the document dictionary
  type: FieldType;
  value: string;         // always a string: dates "YYYY-MM-DD", time "HH:mm", height in cm
  visible: boolean;      // hidden keeps the value (§6)
  multiline?: boolean;   // display style for text fields
  options?: string[];    // select option keys (labels from the document dictionary); typing a custom value is always allowed
  optionKey?: string;    // set when the value was picked from the list: printed in the document language (D33)
  help?: string;
}

export interface FamilyMember { id: string; relation: string; details: string; visible: boolean } // D28

export type Section =
  | { id: string; kind: "fields"; key?: string; title?: string; visible: boolean; fields: Field[] }
  | { id: string; kind: "family"; key?: string; title?: string; visible: boolean; members: FamilyMember[] };

export interface BiodataProfile {
  id: string;
  schemaVersion: number;
  revision: number;      // +1 on every save (D9)
  draftName: string;     // shown in the drafts menu
  createdAt: string;
  updatedAt: string;
  docLanguage: LangCode; // document labels (D11)
  templateId: string;
  colorId: string;
  options: {
    showAge: boolean; dateFormat: "dd-mm-yyyy" | "d month yyyy" | "d-month-yyyy";
    textSize: "auto" | "xs" | "s" | "m" | "l" | "xl"; labelCase: "normal" | "upper";   // D31
    title?: string; motif: string | null; invocation: string;
  };
  sections: Section[];   // array order is display order (no separate order numbers)
  photo?: { crop: { x: number; y: number; zoom: number; rotation: 0 | 90 | 180 | 270 } };
}
```

Dexie stores (`src/lib/db.ts`): `profiles` (`id`, `updatedAt`), `photos` (`profileId` → `{ blob, mimeType, width, height, updatedAt }`), `appMeta` (`key`). Every read goes through the zod schema and `migrate()`; a record that fails is kept untouched and reported ("This draft couldn't be opened"), never deleted.

## A4. Document rendering (D1)

1. `toDocument(profile, dict, today)` (pure) → `DocModel`: only visible, non-empty fields and sections; labels from the dictionary unless renamed; formatted values; age if `showAge`.
2. A template renders the `DocModel` as a list of **blocks** (header with photo, section heading, row, paragraph line group, family rows) using shared primitives and its tokens.
3. Blocks are measured once in an off-screen container at true size (after `document.fonts.ready`); `paginate()` (pure) assigns them to A4 pages: a section heading never ends a page, rows never split, long paragraphs split at line boundaries.
4. The resulting pages render in the preview (scaled), in print (`@page { size: A4; margin: 0 }`) and are the input to the Download engine. User text is always a React text node, never HTML.

## A5. Persistence (VISION §9)

- `profile-repo.ts` is the only code that writes IndexedDB. `save(profile, photo?)` runs one Dexie transaction: check the stored `revision` equals the one the tab loaded, write `revision + 1` (and the photo), commit. A mismatch means another tab saved: autosave stops and the editor shows the reload message.
- `autosave.ts`: state updates immediately; writes debounced 400 ms; flush on `visibilitychange` → hidden, `pagehide` and route changes; status `saving | saved(at) | error(kind)` comes only from transaction results. `QuotaExceededError` gets its own message with "Download a backup" as the action.
- `appMeta.lastOpened` restores the last draft on `/editor` without `?d=`.

## A6. Offline (Step 5.2)

Hand-written `public/sw.js` like EnglishEasy's: precache the app shell pages and their `_next/static` assets, fonts on first use, versioned cache names, `Cache-Control: no-cache` for `sw.js` in `vercel.json`. It never caches anything but same-origin GETs of static files; profiles and photos live only in IndexedDB.

## A7. Design system and quality bar (owner request, 2026-11-20)

Every screen is built **production-quality the first time**, to the standard of Family Tree and EnglishEasy, so the owner never has to ask for spacing, polish or layout fixes screen by screen. The local mockups (`docs/mockups/`) show the target; these rules make it repeatable.

**Visual language**
- Neutral warm surfaces (Tailwind `stone`: page `stone-50`, cards white; Night `stone-950` / `stone-900`) and **one brand colour**, a deep maroon (`#8a1c2b`; Night a warm gold `#e0a64a`) for primary buttons, active states and accents; gold as a secondary accent. Status colours: green saved, amber warnings, red danger.
- **Sans-serif UI everywhere** (the system stack, as in the sibling apps; Noto for Indic text), headings `font-semibold`/`font-bold` with `tracking-tight`. Serif faces appear only inside biodata templates.
- Line icons (inline SVG, 1.8 stroke), rounded controls `rounded-lg`, cards `rounded-2xl` with a 1 px border and `shadow-sm`, soft focus rings.

**Recipes (copy the sibling pattern: plain class-string modules plus a few components in `src/components/ui/`)**
- `button.ts`: `primary` (brand), `secondary` (outlined), `ghost`, `danger`, `dangerOutline`; sizes `sm` h-8, `md` h-9, `lg` h-11; every control `pointer-coarse:min-h-11` (44 px on touch).
- `card.ts` (`card`, `cardHeader`, `cardTitle`, `cardText`, `cardRows`, `dangerCard`), `field.ts` (h-9 fields, 16 px text on touch so iPhones don't zoom, label above, hint below, error/success messages), `badge.ts`, `page.ts`.
- Components: `PageHeader` (title, one-sentence description, actions on the right; below on phones), `Dialog`, `Menu`, `Toast`, `Switch`, `SegmentedControl`, `Skeleton`, `EmptyState`, `Logo`.

**Type scale:** body 15 px (14 in dense panels), hints 13 px, card titles 16 semibold, page titles 24/28, landing H1 44–60 bold tight (34 on phones), section titles 30–36, eyebrows 12 px uppercase with letter spacing.

**Space and layout: use the width, never leave dead space**
- Content width `max-w-6xl` (1152 px) with `px-4 sm:px-6 lg:px-8`; landing sections `py-16 sm:py-24`; card padding `p-4 sm:p-5`; gaps from a 4 px scale (8/12/16/24/32).
- **Content pages** (`/help`, `/privacy`) use the full content width: a left section nav (`w-56`), the text column (`max-w-2xl`), and a right aside card (quick actions, "at a glance"), collapsing to one column below `lg`. No single 800 px column centred on a wide screen.
- **Editor** is full-bleed in three panes: section rail (232 px; icons only below 1280 px), form (440–580 px) as a continuous scroll of section cards (no blank area under the last field), preview filling the rest with the page fitted to the available height. Tablet: form + preview with a toggle; phone: form with a bottom dock (Preview, Download) and a full-screen preview.
- **Landing** follows the siblings' composition: pill badge → H1 (one phrase in the brand colour) → short description → primary + secondary buttons → a large **real product shot** (desktop editor with a phone overlapping) → how it works (3–4 steps) → alternating feature rows (text beside a real screenshot) → templates strip → features grid (3 × 2 cards) → privacy cards → FAQ → closing call-to-action band → footer.
- Grids collapse 4 → 2 → 1; nothing scrolls sideways at 360 px; long words and Indic text wrap (`text-pretty`, `break-words`).

**Quality gate (part of every step's Done when, rule 9)**
- E2e screenshots of every screen the step touches at **phone 390 × 844, tablet 810 × 1080 and desktop 1440 × 900, Day and Night**, saved in `test-results/screenshots/`. Claude **looks at each one before committing** and fixes cramped spacing, dead space, misalignment, clipping, overflow and contrast first.
- Automated checks: no horizontal overflow at 360 px, touch targets ≥ 44 px on phones, visible focus, WCAG AA contrast in both themes.
- Each built screen is compared with its mockup; deliberate differences are noted in the step's notes.

---

# Part B — Rules for every step

1. Read only the VISION/BUILD_PLAN sections the step lists, plus `node_modules/next/dist/docs/` for any Next.js API used (Next 16 differs from older versions).
2. No new dependency unless this plan names it; adding one means updating A1 in the same commit. After any install, `grep -c '"resolved"' package-lock.json` prints `0`.
3. No backend, login, payment, ads, remote fonts/images/CDNs or AI calls. Nothing user-entered leaves the browser. Google Tag Manager only through the public pages' layout (D22); every link from a public page into `/editor` is a plain `<a href>` (a full page load), never `next/link`, so GTM can't follow into the editor.
4. No fake buttons or placeholder controls: a control appears in the step that makes it work.
5. User text is rendered as text only; filenames are sanitised; imported data is validated before anything is written.
6. Printed labels come from `src/i18n/doc/*`, app text from `src/i18n/app/*`; no hardcoded user-facing strings in components after Step 1.1.
7. App chrome supports light and dark (every colour class has a `dark:` twin); the document is always a light page.
8. Pure logic lives in `src/biodata/` or `src/document/` with unit tests beside it. A bug the owner finds gets a test that fails without the fix.
9. **Done when** for every step: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` all pass, plus the step's own checks and the **A7 quality gate** (screenshots at phone, tablet and desktop in Day and Night, looked at and fixed before committing). A step whose outline is short gets its detailed section written here first (decisions with sensible defaults, recorded in its notes) rather than waiting for agreement.
10. **Commit and continue** (owner's choice, 2026-11-20): when the checks pass, commit straight to `main` with a clear title (imperative, ≤ 72 characters, e.g. `Step 1.3: Save drafts to IndexedDB with honest autosave status`) and a description that says what the step adds, decisions and deviations, the test results (counts), and anything the owner should check by hand. No AI attribution trailer. Update the Progress table in the same commit, then start the next step without waiting. Push only when the owner asks (otherwise the owner pushes). Owner-only checks (real iPhone/Android, Vercel, Search Console) are listed in the step's Progress notes and collected; they don't block the next step.
    **Stop and ask only when:** a decision would change the product direction (VISION) or needs an account, payment or external service; a check fails and can't be fixed within the step; or the next step depends on something only the owner can do (e.g. milestone M1, which is the owner's own biodata).
11. A deviation from this plan goes in the step's Progress-table notes (and Part A if architecture changes) in the same commit; a product decision also gets a VISION §24 row.
12. `docs/PROJECT_GUIDE.md` stays true: a new or renamed folder, file or page goes in it in the same commit. README screenshots are refreshed when the screens they show change.

---

# Part C — Steps

## Phase 0 — Repository and rendering spike (VISION §16 Phase 0)

### Step 0.0: Prerequisites (owner)

- **npm token for the mirror.** `npm view next version` currently fails with `E401 Incorrect or missing password`; only packages already in the local cache install. Refresh the token the same way as for Family Tree's step 0, then check `npm view pdf-lib version` prints a version.
- **Sandbox allowlist** (as in the sibling apps): `npm run build`, `npm run dev`, `npm run test:e2e` as `exact_match`.
- **Vercel:** import `harikiranvusirikala/free-wedding-biodata` (Hobby) once Step 0.1 is pushed.

### Step 0.1: Skeleton and static-hosting proof

- **Build:**
  - Next.js 16.4 + React 19 + TypeScript + Tailwind v4 + ESLint (configs mirroring EnglishEasy: `eslint.config.mjs`, `tsconfig.json` with `@/*`, `.npmrc` with `omit-lockfile-registry-resolved=true` and `legacy-peer-deps=false`), `engines.node >=24`.
  - `next.config.ts`: `output: 'export'`, `poweredByHeader: false`, `images.unoptimized: true`, Turbopack Tailwind rule.
  - `vercel.json`: framework `nextjs`; headers for every path: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `Cross-Origin-Opener-Policy: same-origin`; **CSP per path (D15, D22):** `/editor` gets the strict D15 policy (`connect-src 'self'`); the public pages get the same plus Google Tag Manager/Analytics origins (`www.googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`) in `script-src`, `img-src`, `connect-src` and `frame-src`. `sw.js` gets `Cache-Control: no-cache` later (5.2).
  - Routes `/` (a short real landing text: what the app is and the privacy promise, no buttons yet), `/editor` (client page that reads `?d=` and shows it, proving query-param routing in a static export), `/privacy` (the local-storage explanation, VISION §9), a `not-found.tsx`.
  - `src/lib/site.ts` (D17). Vitest + Testing Library + jsdom (`test/setup.ts`), Playwright config like EnglishEasy (phone + desktop projects, installed Chrome locally). For a static export, Playwright's web server is `npm run build` then a tiny static file server script (`scripts/serve-out.mts`, no dependency) on port 3100.
  - CI workflow (`.github/workflows/ci.yml`): `npm ci`, lint, typecheck, test, build, Playwright Chromium, e2e.
  - `.gitignore` (`.DS_Store`, `node_modules/`, `.next/`, `out/`, `test-results/`, `playwright-report/`, `*.tsbuildinfo`, `next-env.d.ts`), README (what, why, run locally, known limitations), MIT `LICENSE`, `.claude/CLAUDE.md`.
  - `src/app/icon.svg` copied from the approved `docs/brand/app-icon.svg` (VISION D48; no text, so sharp renders it exactly) and a first `npm run images`: favicon, apple icon, `opengraph-image.png` and **`docs/social-preview.png`** from the icon, name and tagline (no screenshots exist yet; Step 6.1 rebuilds both with real screens). The owner uploads the social preview in the GitHub repo settings.
  - A first `docs/PROJECT_GUIDE.md` (folders and pages so far, one Mermaid diagram), linked from the README.
- **Tests:** unit test for `site.ts`; e2e: `/`, `/privacy`, `/editor?d=abc` load from the static server; a reload of `/editor?d=abc` keeps `abc`; no request leaves `localhost`.
- **Done when:** Part B checks; `out/` contains `index.html`, `editor.html`, `privacy.html`; owner: Vercel preview opens all three routes and `curl -I` on the preview shows the CSP header.

### Step 0.2: PDF and Indian-script spike

- **Fixture** (`test/fixtures/scripts.ts`): for each of the ten languages, a label set and values chosen to stress shaping: conjuncts and reph (శ్రీ, క్ష్మ, స్త్రీ, కృష్ణమూర్తి; श्रीमती, द्वितीय, कार्यालय, कि; ஸ்ரீ, க்ஷ, கொ; ಕರ್ನಾಟಕ, ಶ್ರೀ; ശ്രീ, ക്ഷ, ൻ; महाराष्ट्र, ळ, र्‍य; શ્રી, દ્ર; শ্রী, ক্ষ, র্য, কি; ਸ਼੍ਰੀ, ਪ੍ਰ, ਕਿ), ZWJ/ZWNJ (సాఫ్ట్‌వేర్), Indic and Latin digits, mixed English/Indic values, a 60-character name, a long address and a 600-word paragraph that must flow to page 2.
- **Fonts:** `npm run fonts` copies Noto Sans + the eight script fonts (Regular, Bold, static TTF) into `public/fonts/` with `OFL.txt`; record total and per-file sizes.
- **Reference page:** `/dev/pdf-spike` renders the fixture as A4 HTML pages laid out like the owner's reference biodata (gold corner foliage, motif, amber heading bars, label/value rows, photo top-right; a fictional profile and a placeholder photo, never the real values), page 1 in English and further pages per language, so the spike also proves the Classic Gold look.
- **Candidates**, each producing `docs/spikes/pdf/<candidate>-<lang>.pdf`:
  - **A** `@react-pdf/renderer` with the same TTFs (a minimal equivalent layout).
  - **B** Chrome print-to-PDF of the reference page (Playwright `page.pdf()`, identical to `window.print()` → Save as PDF).
  - **C** prototype vector writer: walk the reference page's DOM, split text nodes into lines with `Range.getClientRects()` over grapheme clusters (`Intl.Segmenter`), shape each line with `harfbuzzjs` using the same TTF, emit glyph IDs with `pdf-lib` (Type0/Identity-H font, ActualText spans for copy/paste), plus borders, backgrounds, the photo and one SVG ornament.
  - **D** raster: the pages drawn to a 300 DPI canvas, JPEG into `pdf-lib`.
- **Evaluation** (`docs/spikes/PDF_SPIKE.md`):
  - Rasterise every PDF page with macOS's own PDF renderer and compare each script line side by side with Chrome's screenshot of the reference page (images in `docs/spikes/pdf/`).
  - Text extraction (copy/paste) per PDF: does the extracted text equal the fixture?
  - File size, generation time in Chrome on desktop and on a throttled phone profile, lazy-loaded bundle size (wasm + JS).
  - **Image export (D38):** for the leading candidate, draw page 1 to a canvas at 1240 × 1754 from the same data and compare it with the PDF page; record JPEG/PNG sizes.
  - Owner checks on a real iPhone (Safari) and an Android phone: candidate C's download and Share, B's print flow.
- **Decision rule:** pick the candidate that (1) matches the Chrome reference glyph-for-glyph in all ten languages, (2) gives a one-click download and Share on Android Chrome and iOS Safari, and can also produce a matching page image (D38), (3) keeps one layout for preview and export, (4) has selectable text, (5) adds the least code and dependency surface. Record it as a new VISION §24 row superseding D1's "proposed" status, and update A1/A4.
- **After the decision:** spike code that isn't the chosen engine is deleted; the fixture, font script and evaluation report stay.
- **Done when:** report written with images; decision recorded; Part B checks pass.

## Phase 1 — Foundation and local persistence

- **1.1 App shell:** header (name, drafts menu slot, theme menu, help link), theme as **Day / Night / Follow device** set before first paint (Family Tree's `theme-script.ts` pattern, `dark` class on `<html>`), UI kit, app dictionary (`en`), footer with the Buy me a coffee link (D25), `/help` and `/privacy` content, error screens.
- **1.2 Profile model:** `types.ts`, `schema.ts`, `defaults.ts` (§6 sections and fields, no complexion, starter field sets D32), `migrate.ts` (v1), `edits.ts` core (set value, toggle visibility); unit tests.
- **1.3 Persistence:** Dexie DB v1, `profile-repo.ts`, `autosave.ts`, save status, revision check across tabs, failure and quota messages; unit tests with `fake-indexeddb` (including simulated write failure and quota error); e2e: type → reload → restored.
- **1.4 Drafts:** create, open, rename, duplicate, delete with confirmation (the "download a backup first" offer is added in 5.1, when backups exist), last-opened restore, landing "Continue editing", storage status (`estimate`, `persist`), "Delete all my local data".

## Phase 2 — Editor and dynamic fields

- **2.1** Section navigation and inputs for every field type (first letter of labels and values capitalised automatically, VISION D47) (date, time, height picker, select with custom value, phone, email hints, textarea).
- **2.2** Field and section management: add, rename, change type/display style, hide, remove (confirm), move up/down, **move to another section**, custom sections, restore defaults.
- **2.0** Editor opening (VISION D43): the Top of your biodata card (motif / invocation / title, None first, in template colours), the language notice, tradition field chips.
- **2.3** References section and multi-contact relations (D44); family members list (D28: relation with suggestions + details; add, edit, reorder, remove), sample profile ("Open a sample", always a new draft, fictional), completion indicators.

## Phase 3 — Photo and live preview

- **3.1** Photo: pick, validate, downscale (≤ 3000 px long edge), own cropper (drag, pinch, zoom slider, rotate) with a 3:4 or tall 2:3 frame, replace, remove, optional second photo, empty-state tips, and a low-resolution warning below ~200 dpi at the chosen frame size (VISION D12, D40, D47).
- **3.2** Document primitives, tokens, `toDocument`, `paginate` (with D31 Auto text size: try the template's sizes largest first until one page fits, floor 9 pt), the **Classic skeleton** (D34); **Classic Gold first**, matched against the owner's reference side by side (original foliage and Ganesha artwork, D21/D29), then Minimal Ivory; document labels en + te.
- **3.3** Preview pane (desktop sticky, tablet collapsible; on phones the floating Preview pill and bottom sheet with preview, design/colour chips, text size and Download / Share / Save image, VISION D45), zoom, fit, page count, template/colour/document-language pickers, text size (Auto, XS–XL) and label case (D31), title and motif pickers.

## Phase 4 — PDF and template collection

- **4.1** Download PDF (engine from 0.2), Share PDF, **Save/Share as image** (JPEG/PNG per page from the same display list, VISION D38), Print, filenames `Marriage-Biodata-<FirstName>.pdf` / `-page-<n>.jpg`, progress and error feedback, no main-thread freeze. **Ends with milestone M1:** the owner builds their own biodata in the app and compares the PDF with their reference.
- **4.2** All ten document dictionaries and fonts; script fixture PDFs regenerated and reviewed (VISION §15 PDF/script tests).
- **4.2b** Photo pages (up to 4 extra photos, 1/2/4 per page, inside the template frame) and the attached horoscope page (VISION D40, D41).
- **4.3** Designs 3–10 and their frame families (adds the Modern and Minimal skeletons, D34, D46).
- **4.4** Designs 11–20, the motif library with glyph motifs converted to paths (D21, D45, D47), and three colour variants for every design.

## Phase 5 — Backup and offline

- **5.1** Backup export/import (D8): preview, add-as-new or replace, validation, older-version migration; "download a backup first" offered before destructive actions.
- **5.2** Manifest, icons, service worker, offline e2e (network off after first load → edit → download PDF), privacy network e2e (D15).

## Phase 6 — Polish and launch

- **6.1 Landing and search engines (D22, D26, D27):** the professional landing page modelled on Family Tree's and EnglishEasy's (hero with a real biodata picture and "Create my biodata" / "Continue editing", how it works, templates strip, privacy promise, languages, FAQ, footer with support link); `content.ts` (`TITLE`, `DESCRIPTION` ≤ 160 chars with a unit test, `FAQ` rendered and in `FAQPage` JSON-LD, `WebApplication` JSON-LD with price 0, `GOOGLE_SITE_VERIFICATION`); canonical and Open Graph metadata per public page; `robots.ts`/`sitemap.ts` index Production only; `GoogleTagManager` in the public layout with `gtmId()` unit tests; e2e `capture.spec.ts` takes clean screens → `docs/screenshots/` → `npm run images` rebuilds the landing WebPs, link preview and **social preview** from real screens; README gets the screenshots; `/templates` gallery and `/help` FAQ. Plus the D36 search structure: ten language landing pages with `hreflang`/`og:locale` alternates, five tradition pages, the image gallery, the "what to write in each part" guide, and the structured data list (no `HowTo`, no counters). Footer notice: a document tool only; it doesn't match or connect people (D35). E2e: the editor loaded from the landing page's button makes no third-party request.
- **6.2** Accessibility pass (WCAG 2.2 AA), phone QA, night-theme screenshots of every screen, PROJECT_GUIDE review.
- **6.3** Owner checks before launch: community review of the Khanda and Jain motifs and native-speaker review of the label translations (VISION D47); production checks on real devices, README deployment/rollback/troubleshooting, launch.

---

# Part D — Progress

| Step | What | Status |
|---|---|---|
| 0.0 | Prerequisites (owner): npm token, sandbox allowlist, Vercel project | npm token refreshed 2026-11-20 (`npm login`; all Phase 0 packages resolve). Sandbox allowlist and Vercel project still to do |
| 0.1 | Skeleton and static-hosting proof | Not started |
| 0.2 | PDF and Indian-script spike | Not started |
| 1.1 | App shell | Not started |
| 1.2 | Profile model | Not started |
| 1.3 | Persistence and autosave | Not started |
| 1.4 | Drafts and storage status | Not started |
| 2.0 | Editor opening: top element card, language notice, tradition chips | Not started |
| 2.1 | Editor inputs | Not started |
| 2.2 | Field and section management | Not started |
| 2.3 | Family members and sample profile | Not started |
| 3.1 | Photo | Not started |
| 3.2 | Document engine and first two templates | Not started |
| 3.3 | Live preview | Not started |
| 4.1 | Download, Share, image export, Print | Not started |
| M1 | Owner's own biodata made with the app (VISION D29) | Not started |
| 4.2 | Ten languages in the document | Not started |
| 4.2b | Photo pages and attached horoscope page | Not started |
| 4.3 | Designs 3–10 and frame families | Not started |
| 4.4 | Designs 11–20, motif library, colour variants | Not started |
| 5.1 | Backup and restore | Not started |
| 5.2 | Offline and privacy checks | Not started |
| 6.1 | Landing, search engines, gallery, help, pictures | Not started |
| 6.2 | Accessibility, phone QA, night theme check | Not started |
| 6.3 | Launch | Not started |
