# Free Wedding Biodata — Build Plan

**Product:** [VISION.md](VISION.md) (§ numbers and decisions D1… below refer to it) · **Started:** 2026-11-20

This file says **how** the app is built: architecture (Part A), rules every step follows (Part B), the steps (Part C) and the Progress table (Part D). Status lives only in the Progress table. Each step ends with its checks passing and a commit straight to `main`; the next step then starts without waiting (owner's choice, 2026-11-20, see Part B rules 9–10). Phase 0 is detailed now; later steps are outlines that are detailed in this file, in the same commit as the code, as each one starts.

**Look and feel:** `docs/mockups/` (local only, git-ignored, owner's choice 2026-11-20) shows every page (landing, editor on desktop and phone in Day and Night, phone preview, templates, help, privacy) and the Classic Gold biodata, drawn with a fictional profile; `bash docs/mockups/tools/render.sh` re-renders them. Once the owner agrees them, steps that build a screen match its mockup and record any deliberate change in the step notes. Only real screenshots of the built app are committed (`docs/screenshots/`, Step 6.1).

**Milestone M1 (VISION D29): the owner makes their own biodata with the app**, matching their reference PDF (`docs/references/`, git-ignored) in the Classic Gold template, and downloads it. M1 is reached at the end of Step 4.1; the steps up to it build exactly what that biodata needs first.

---

# Part A — Architecture

## A1. Stack (VISION §12, decided 2026-11-20)

- **Next.js 16** (App Router, Turbopack) with **`output: 'export'`**: `next build` writes a static `out/` folder. No route handlers, server actions, `proxy.ts`, `headers()`, cookies or default image loader (unsupported in static export, and not wanted). Don't enable `cacheComponents`.
- **React 19**, **TypeScript 5** strict (TypeScript 7 exists but Next.js's tooling and the siblings use 5), **Tailwind CSS v4** wired like the sibling apps (`@tailwindcss/turbopack` loader in `next.config.ts`, no PostCSS config).
- **zod 4** (profile, database reads, backup import), **Dexie** (IndexedDB), `fake-indexeddb` (unit tests only).
- **PDF (decided in Step 0.2, VISION D49):** **`harfbuzzjs`** (text shaping, WebAssembly; `turbopack.resolveAlias` maps its Node-only `module` import to `src/lib/empty-module.ts` in browser builds) + **`pdf-lib`** (PDF writing), lazy-loaded on the first download, fed by the display list read from the laid-out pages. Page images: the same display list drawn on a canvas. Print through `window.print()`. Spike evidence: `docs/spikes/PDF_SPIKE.md`.
- **Fonts:** Noto Sans static TTFs (OFL 1.1), Regular and Bold, copied into `public/fonts/` with `OFL.txt` by `npm run fonts` from the `@expo-google-fonts/noto-sans*` packages (dev dependencies; 3.4 MB for nine families, confirmed in Step 0.2).
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
  templates/<id>/            one folder per design (20, D46) on three skeletons (classic, modern, minimal, D34)
  frames/                    original SVG frame families (corner/border art, D46)
  motifs/                    original SVG motif artwork (D21)
src/pdf/                     the Download engine (D49, Step 4.1): display list read from the laid-out pages → HarfBuzz + pdf-lib PDF, or canvas page images (lazy-loaded)
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
public/sw.js                 hand-written service worker template (Step 5.2); the build fills in its file list
src/app/manifest.ts          install manifest (opens /editor)
scripts/*.mts                fonts, images (site-images.mts), serve-out, sw-build (fills out/sw.js after next build); run with node --import tsx
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

**Since Step 1.2 the source of truth is `src/biodata/types.ts`** (the block above is the original sketch). Differences: option lists are looked up by field key (`OPTION_LISTS`), not stored in drafts; family members carry `relationKey` (picked, printed in the document language) or a free `relation`; fields may carry a `note`; options add `heightFormat` and `titleKey`; photos are `photo` (frame `3:4` | `2:3`), `secondPhoto`, `photoPages` (1/2/4 per page, ≤ 4) and `horoscopeChart`, each `{ id, crop }`.

Dexie stores (`src/lib/db.ts`): `profiles` (`id`, `updatedAt`), `photos` (`id` → `{ profileId, blob, mimeType, width, height, updatedAt }`, indexed by `profileId`; up to 7 per profile), `appMeta` (`key`). Every read goes through `migrate()` (zod inside); a record that fails is kept untouched and reported ("This draft couldn't be opened"), never deleted.

## A4. Document rendering (D1)

1. `toDocument(profile, dict, today)` (pure) → `DocModel`: only visible, non-empty fields and sections; labels from the dictionary unless renamed; formatted values; age if `showAge`.
2. A template renders the `DocModel` as a list of **blocks** (header with photo, section heading, row, paragraph line group, family rows) using shared primitives and its tokens.
3. Blocks are measured once in an off-screen container at true size (after `document.fonts.ready`); `paginate()` (pure) assigns them to A4 pages: a section heading never ends a page, rows never split, long paragraphs split at line boundaries.
4. The resulting pages render in the preview (scaled), in print (`@page { size: A4; margin: 0 }`, last page `break-after: auto`) and are the input to the Download engine: a **display list** read from the laid-out pages (each text line with its baseline, font, size and colour; boxes; photo; SVG ornaments) is written as a vector PDF (HarfBuzz shaping with the same TTFs, subset fonts, `/ActualText`) or drawn on a canvas for page images (D49). User text is always a React text node, never HTML.

## A5. Persistence (VISION §9)

- `profile-repo.ts` is the only code that writes IndexedDB. `save(profile, photo?)` runs one Dexie transaction: check the stored `revision` equals the one the tab loaded, write `revision + 1` (and the photo), commit. A mismatch means another tab saved: autosave stops and the editor shows the reload message.
- `autosave.ts`: state updates immediately; writes debounced 400 ms; flush on `visibilitychange` → hidden, `pagehide` and route changes; status `saving | saved(at) | error(kind)` comes only from transaction results. `QuotaExceededError` gets its own message with "Download a backup" as the action.
- `appMeta.lastOpened` restores the last draft on `/editor` without `?d=`.

## A6. Offline (Step 5.2)

Hand-written `public/sw.js` like EnglishEasy's: precache the app shell pages and their `_next/static` assets, every font and the PDF engine's WebAssembly (listed at build time by `scripts/sw-build.mts`; the lazy engine and other-script fonts would otherwise be missing offline), versioned cache names (the previous version's cache is kept for editors still open), `Cache-Control: no-cache` for `sw.js` in `vercel.json`. It never caches anything but same-origin GETs of static files; profiles and photos live only in IndexedDB.

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
13. **Parallel work** (owner's choice, 2026-11-21): steps with no dependency between them (the map below) run at the same time, each in a subagent working in its own git worktree with a self-contained brief (the step's section, the files it owns, the checks to run). Subagents don't edit the shared files (`package.json`, the Progress table, `PROJECT_GUIDE.md`, `.claude/CLAUDE.md`); they report what those need. The main thread reviews each result, merges it, runs the full checks, and commits **one step per commit, in dependency order** (a step is committed after the steps it depends on; independent steps in the order they finish). A step that touches another lane's files waits for it.
14. **Verification in the local sandbox:** headless Chrome can't start inside Claude Code's sandbox (its profile lock socket is refused), so `npm run test:e2e` and the A7 screenshots run with the owner's one-time approval of that command (a dialog, or the Tools allowlist entry `npm run test:e2e`, exact match). If that isn't available, the step still writes its e2e specs, runs everything else, notes "e2e not run locally" in its Progress row, and CI runs the e2e on the owner's next push. Static pages can also be screenshotted with the WebKit snapshot tool (`docs/mockups/tools/snap.swift`).
15. **Look before building a screen:** a step that builds a screen opens its mockup in `docs/mockups/` (local) first and matches it; differences go in the step's notes.

**Dependency map (what can run in parallel):**

```text
0.1 ─┬─ 0.2 PDF spike ───────────────────────────────┐
     ├─ 1.1 App shell ─┐                              │
     └─ 1.2 Profile ───┼─ 1.3 Persistence ─ 1.4 Drafts├─ 4.1 Download/M1 ─ 4.2b
                       │       ├─ 3.1 Photo ──────────┤
                       │       └─ 5.1 Backup          │
                       ├─ 2.0 → 2.1 → 2.2 → 2.3 → 2.4 ┤
                       ├─ 3.2 Document engine → 3.3 ──┘─ 4.3 ∥ 4.4 (designs split across agents)
                       └─ 4.2 dictionaries (labels can be drafted any time after 1.2; fonts after 0.2)
5.2 after 4.1 · 6.1 after 4.4 (landing needs real screens) · 6.2 → 6.3
```

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
  - Public pages live in the `(public)` route group from the start (A2); its layout gets `GoogleTagManager` in 6.1.
  - Routes `/` (a short real landing text: what the app is and the privacy promise, no buttons yet), `/editor` (client page that reads `?d=` with `useSearchParams` inside `<Suspense>` and shows it, proving query-param routing in a static export), `/privacy` (the local-storage explanation, VISION §9), a `not-found.tsx`.
  - `src/lib/site.ts` (D17). Vitest + Testing Library + jsdom (`test/setup.ts`), Playwright config like EnglishEasy (phone + desktop projects, installed Chrome locally). For a static export, Playwright's web server is `npm run build` then a tiny static file server script (`scripts/serve-out.mts`, no dependency) on port 3100 that serves `/editor` from `editor.html` the way Vercel does.
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
- **Parallel:** the fixture and font script come first (main thread); then candidates A, B, C and D are independent and run as parallel subagents; the evaluation and decision come last (main thread).
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
- **1.2 Profile model:** `types.ts`, `schema.ts`, `defaults.ts` (§6 sections and fields, starter field sets D32; Complexion added below Height by D52), `migrate.ts` (v1), `edits.ts` core (set value, toggle visibility); unit tests.
- **1.3 Persistence:** Dexie DB v1, `profile-repo.ts`, `autosave.ts`, save status, revision check across tabs, failure and quota messages; unit tests with `fake-indexeddb` (including simulated write failure and quota error); e2e: type → reload → restored.
- **1.4 Drafts:** create, open, rename, duplicate, delete with confirmation (the "download a backup first" offer is added in 5.1, when backups exist), last-opened restore, landing "Continue editing", storage status (`estimate`, `persist`), "Delete all my local data".

### Step 1.1: App shell (built 2026-11-21)

- **Built:** theme (`src/lib/theme-script.ts` before first paint; `settings-store.ts` with `useSyncExternalStore`: Day/Night saved under `theme`, Follow device saves nothing and follows the device and other tabs); `ThemeMenu` (WAI-ARIA menu, radio items); the UI kit in `src/components/ui/` (A7 recipes `button`, `card`, `field`, `badge`, `page`; `Menu`, `Dialog`, `Toast`, `Switch`, `SegmentedControl`, `Skeleton`, `EmptyState`, `PageHeader`, `icons`); the app dictionary `src/i18n/app/en.json` + `src/lib/i18n.ts` `t()` (all page text moved; `Rich.tsx` renders `<b>` only, never HTML); `SiteHeader`, `SiteFooter`, `AppHeader`, `MessageScreen`, `ContentPage`, `SectionNav`; `/help`; `/privacy` rebuilt; `error.tsx`; dev-only `/dev/ui` (gallery) and `/dev/error`.
- **Decisions:** the theme button shows the theme in use (sun/moon drawn by CSS from the `dark` class, so it never swaps after hydration); links between pages are plain `<a>`; content grid 12rem / text / 17.5rem aside, below `lg` the section list becomes chips and aside cards turn into rows; the help page says the editor is still being built and marks backups and offline as coming, with no dates; e2e checks 44 px touch targets on phones.
- **Deviations from the mockups:** nav shows only Help and Privacy (rule 4); the privacy aside has At a glance, Check it yourself (GitHub) and Questions? instead of Back up / Delete all (not built yet); the privacy title stays "Your biodata stays with you" (the mockup's "never leaves" isn't true once you share it); footer has Use and Project columns only.
- Built by a subagent in parallel with 1.2 and the 1.3 storage layer.

### Step 1.2: Profile model (built 2026-11-21)

- **Built** (`src/biodata/`, pure TS): `types.ts` (A3 types plus `LangCode`, `CURRENT_SCHEMA_VERSION`), `schema.ts` (zod 4 `profileSchema`, compile-time checked against `BiodataProfile`), `defaults.ts`, `migrate.ts`, `edits.ts`; unit tests beside each.
- **Default sections** (§6, D28, D39): About me → Personal → Religion and community → Horoscope → Education → Career → Family (Father, Mother) → Family background → Contact → Partner preferences. Complexion below Height (D52, owner's choice), no stored age. §6 "Profile" is folded in (name and gender head Personal; title in `options`; photo in `photo`). Family type/values sit in Family background because Family is a relation list; the duplicate "Native place" in Family background is dropped (Personal has it).
- **One field catalogue** (`FIELD_CATALOG`: key → type, option list) feeds new drafts, Restore defaults (2.2), the tradition chips (`TRADITION_FIELD_SETS`, D32/D43: data only, never added by default; a starting list for 2.0 to review) and later the dictionary completeness tests.
- **Options lists aren't stored in drafts** (deviation from the A3 sketch): `OPTION_LISTS` by field key, so fixed lists reach old drafts. `optionKey` wins over `value`; typing clears it (D33).
- **References** (D44) is a family-kind section offered in `QUICK_PICK_SECTIONS`, not a default; a contact's relation note is `Field.note`.
- **Option defaults:** `showAge` false (D13 opt-in), `dd-mm-yyyy`, `ft-in`, `auto`, `normal`, `motif` null, `invocation` "" (None first, never inferred).
- **Schema** is strict on types and enums, rejects duplicate ids, requires a key or label on every field and a key or title on every section, no length caps (D6); unknown keys are stripped so later releases can add optional properties without a version bump; newer `schemaVersion`s are refused before parsing.
- **`migrate()`** never throws: `{ ok, profile, fromVersion }` or `{ ok: false, error: { code: "not-a-profile" | "too-new" | "invalid" } }`; `UPGRADES` is empty at v1.
- **Edits** (D6): `setFieldValue`, `pickFieldOption`, `setFieldVisible`, `renameField`/`resetFieldLabel`, `setSectionVisible`, `renameSection`/`resetSectionTitle`; immutable with structural sharing, a no-op returns the same object, `updatedAt` from an injected clock, `revision` untouched (persistence owns it), values never trimmed.
- **`SAMPLE_PROFILE`**: fictional Sai Teja Mandapati, +91 90000 0000x numbers, deep-frozen; includes a renamed field, a custom field, a hidden field and a References section.
- **Open for later:** a per-section display style (rows / list / paragraph, D44) and the "(Late)" relation prefix aren't modelled yet (both can be added as optional properties); D32/D43 don't say which fields each tradition chip adds, so the lists are provisional (Step 2.0 decides); a `Field.note` prints as typed (not translated).

### Step 1.3: Persistence and autosave (built 2026-11-21)

- **Storage** (`src/lib/`): `db.ts` (Dexie v1: `profiles` by id/updatedAt, `photos` by id/profileId, `appMeta`); `profile-repo.ts`, the only writer: `load`, `list`, `save(profile, { expectedRevision, photos })` in one transaction, `create`, `remove`, `getPhoto`, last opened. Results, not exceptions: `quota | conflict | unavailable | unknown`, plus `missing | broken` on load. Reads go through `migrate()`; a broken record is reported and kept. A draft deleted in another tab gives `conflict`, so it's never brought back.
- `autosave.ts`: state updates at once, writes 400 ms after typing stops, one write at a time; "saved" only after commit; a conflict stops it for good; other errors stay pending (Try again shows Saving…). `attachLifecycle` flushes on hidden/pagehide. `use-autosave.ts` reads it in React.
- `open-draft.ts`: `?d=<id>`, else last opened (a vanished one starts fresh, a broken one is shown), else a new draft; sets `lastOpened`.
- **Editor** (`src/app/editor/`): the id goes into the address with `history.replaceState`. Screens: loading skeleton, "Draft not found" and "This draft couldn't be opened" (Start a new draft; broken records untouched), blocked storage, read failure.
- **Form:** a "Personal details" card (Full name, Date of birth as text, Nationality, Current city, Native place); labels from `field.<key>` in the app dictionary until the editor uses the document dictionaries. Aside: "Saved on this device only" + How saving works.
- **Save status** in the header (polite live region): Saving… / Saved on this device · time (phones: Saved · time) / Not saved, plus a message above the form: out of space (free some space, Try again), changed in another tab (form read-only, Reload), blocked or unknown (Try again). Links out of the editor save pending changes first.
- **Tests:** unit with fake-indexeddb (quota, conflict, blocked, atomic profile + photo, broken records); `e2e/drafts.spec.ts`: reload restores, Saving before Saved and the value on disk, last draft, link flush, two tabs, unknown id, broken record, blocked storage.
- **Deviations:** the quota message has no "Download a backup" button until 5.1; Date of birth is free text until 2.1 (2.1 must read typed values); the editor is one column + aside, not the three panes (Phase 2); `save` takes `{ expectedRevision, photos: { put, delete } }`. Storage layer and editor wiring built by two subagents (the second in parallel with 3.2).

### Step 1.4: Drafts and storage status (built 2026-11-21)

- **Drafts menu** (`DraftsMenu.tsx`, editor header): the open draft's name; drafts newest first with "Edited 2 days ago"; switching writes pending changes, then a full load; New draft, Rename…, Duplicate, Delete…, Delete all my local data…; broken drafts show "Can't be opened" with Delete only.
- **Names** (`src/biodata/draft-name.ts`, pure): `draftName` "" means automatic, from the Full name ("Sai Teja Mandapati" → "Sai Teja's biodata"; initials skipped; long names → first word), else "Untitled biodata". Rename stores the trimmed name; empty goes back to automatic. Never printed.
- **Repo:** `duplicate(id, { draftName })` copies profile + photos with new ids in one transaction; summaries carry `fullName`.
- **New drafts:** `/editor?new=1` (`openNewDraft`) from Create my biodata (hero, header, footer) and New draft; an untouched last draft (revision 0, blank) is reopened rather than piling up empty drafts; the address becomes `?d=`. Duplicate opens the copy ("<name> (copy)"); Delete opens the newest remaining draft, else a new one.
- **Landing:** "Continue editing <name>" under Create my biodata in a reserved line (fades in, no layout jump); `local-data.ts` is loaded by `import()` after hydration and checks `Dexie.exists` first, so a first visit creates no database.
- **Storage** (`storage-status.ts`, `StorageCard`, editor aside): space used, protected or not, "Keep my drafts safe" (`persist()`, the browser's answer shown as given), a warning that clearing browsing data deletes drafts.
- **Delete all** (`local-data.ts`, `DeleteAllDialog`, drafts menu + privacy aside): type DELETE; deletes the database (closed for good) and this site's localStorage, then goes to `/`.
- **Deviations:** Continue sits under the main button, not beside it (no layout jump); the privacy aside has Delete all but no backup card (5.1); storage sits in the aside, not a menu panel. Also fixed `e2e/theme.spec.ts`'s outside-click target (the open menu covered the heading on phones).

## Phase 2 — Editor and dynamic fields

- **2.0** Editor opening (VISION D43): the Top of your biodata card (motif / invocation / title, None first, in template colours), the language notice, tradition field chips.
- **2.1** Section navigation and inputs for every field type (first letter of labels and values capitalised automatically, VISION D47) (date, time, height picker, select with custom value, phone, email hints, textarea).
- **2.2** Field and section management: add, rename, change type/display style, hide, remove (confirm), move up/down, **move to another section**, custom sections, restore defaults.
- **2.3** References section and multi-contact relations (D44); family members list (D28: relation with suggestions + details; add, edit, reorder, remove), sample profile ("Open a sample", always a new draft, fictional), completion indicators.
- **2.4** Simple / Detailed forms (D50, owner's request 2026-11-22, before M1): the switch at the top of the editor (Simple by default), the Simple layout, the pure switching edit with Undo, tradition chips and Add a field/section working in both, existing drafts as Detailed.
- **2.5** App colour polish (D51, owner's request 2026-11-22): restrained maroon → rose / maroon → gold gradients on primary buttons, the landing headline accent, editor card top strips and header icon tiles, a faint warm page wash; Day and Night; AA contrast; no layout changes.

### Step 2.1: Section navigation and inputs (built 2026-11-21, before 2.0)

- **Layout (A7):** ≥ 1280 px a 232 px rail (dot, name, "3/9"; the highlight follows scroll; a click scrolls and focuses the card title); 1024–1279 an icon rail; below, sticky chips with short names. Form 440–580 px of section cards; the right column holds the aside cards until 3.3 (no placeholder preview); below `lg` they follow the form.
- **Inputs:** text, phone (tel), email; textareas grow (advisory 600/500 counts, D44); address multiline; date typed day-first (month names too), stored ISO, a calendar button opens the native picker; time typed, stored `HH:mm`, shown 12-hour; height one ft/in list 4'0"–7'6" with cm, stored in cm; family rows: relation label + wrapping details.
- **Select (D33):** an editable ARIA combobox (filters as you type; Enter picks; Esc closes) instead of select + "Other…": one control, and long lists filter. Typing clears `optionKey`; typing an option's full name picks it.
- **Hidden:** eye toggle (`aria-pressed`), muted row + "Hidden" badge, values kept; hidden rows leave the completion count (`src/biodata/completion.ts`).
- **D47 capitalisation:** on blur, only if typed during this focus, Latin text only; "iPhone" left alone; putting the small letter back turns it off for that field (per session).
- **Old values:** 1.3's free-text dates show tidily when readable and are stored ISO once the field is left; other text stays as typed with a hint (`src/biodata/inputs.ts`).
- Labels and options in the editor come from the English document dictionary; edits go through one stable `edit()` with memoised cards and rows (typing stays instant on a 50-field profile).
- **Deviations:** built before 2.0 (2.0's top card sits inside this structure); no ⋯ field menus (2.2); About Me repeats its title as the field label. Built by a subagent in parallel with 3.1 and the 4.2 labels.

### Step 2.2: Field and section management (built 2026-11-21)

- **Built:** pure edits (`addCustomField`, `addCatalogField`, `changeFieldType`, `setFieldMultiline`, `removeField`/`insertField`, `moveField`, `moveFieldToSection`, `addCustomSection`, `addPresetSection`, `removeSection`/`insertSection`, `moveSection`, `restoreSectionDefaults`, `missingDefaults`); ⋯ menus on rows and cards (Rename, Change type ▸, Multiple lines, Move up/down, Move to section ▸, Hide/Show, Remove); "Add a field" at each card's foot; "Add a section" after the last card and in the rail. `Menu` gained opt-in `autoPlace` (opens upwards when there's more room).
- **Restore defaults:** re-adds only the section's default fields that are nowhere in the draft (a moved field counts as present), empty and shown, each after the nearest earlier default still in the section (else before the next, else at the end); never removes, reorders, renames, retypes, unhides or clears anything; the title is untouched. Family re-adds missing Father/Mother.
- **Type change:** date/time/height become the text the editor showed; text that reads as the new type is stored in its format; else kept as typed. `optionKey` is dropped unless it stays a list; a paragraph with line breaks becomes a multi-line row. Custom fields: text, paragraph, date, time, phone, email; catalogue fields may go back to their own type.
- **Undo:** keeps the removed field/section and its index in memory and puts it back into the current profile (edits made meanwhile survive), 6 s, paused on hover/focus; forgotten on reload.
- **Add a field:** this section's missing usual fields (incl. its tradition fields), then other sections' missing defaults; or a custom label + type. **Add a section:** References, any removed default section (minus fields moved elsewhere), or a custom title; appended at the end.
- **Rename:** saving the usual name or a blank restores the dictionary label, so it keeps printing in the document language.
- **Deviations:** no "Move a field here" button (mockup); an empty relation list (References) shows a note until 2.3 adds members; family rows get their ⋯ in 2.3. Built by a subagent in parallel with the 4.1 engine.

### Step 2.0: Editor opening (built 2026-11-22, after 2.1/2.2)

- **Top of your biodata** (`TopCard`), first in the form and rail: Symbol (None + 13 original drawings in `src/document/motifs/library.tsx`, 2 × 7 tiles in the design's paper and ink, "See them larger"), Invocation line (None, 12 lines by tradition, Write your own; stored as editable text, `src/biodata/invocations.ts`), Title (None / Biodata / Marriage Biodata / Bio-Data in the document language, or your own). Pure edits `setMotif`, `setInvocation`, `setTitle`/`titleChoice`. None is first and preselected (D21).
- Om and Ik Onkar are outlines taken from Noto Bold (D47); the crescent and rings use no masks (the PDF writer has none); the Khanda and Jain symbols carry COMMUNITY REVIEW comments (6.3).
- Invocation lines and titles print in their own script on any page (`src/document/scripts.ts` `mixedFontStack`; the extra fonts load before measuring). `fontStack` is not widened globally because the PDF writer loads every font in a stack.
- **Language notice** + dialog: ten languages named in their own script, unreviewed ones marked; `setDocLanguage`.
- **Tradition chips** (in Religion, else Horoscope; at most 4 fields each, added once, Undo): Telugu (Intiperu, Lagnam, Dosham), Tamil (Kuladeivam, Lagnam, Dosham), Marathi (Devak, Kuldevta, Gan, Nadi), Hindu – other (Lagnam, Dosham, Kula Devata), Muslim (Sect, Maslak), Christian (Denomination, Church / Parish), Sikh (Practice, Gotra), Jain (Sect, Gotra). No Allah medallion (needs vector calligraphy). `/dev/draft` renders a stored draft for e2e.
- **Motifs redrawn (2026-11-22):** 19 original symbols plus None (Hindu 6, Muslim 3, Christian 2, Sikh 2, Jain 1, Buddhist 2, not religious 3) as single-colour wedding-card artwork in the design's colours: calligraphic brush strokes (`geometry.ts` `brush`), one vertical gradient, no pale disc, details cut in the paper colour (`Motif` `paper` prop). New ids `ganeshaOrnate`, `allah`, `allahMedallion`, `crossBudded`, `dharmaWheelSolid`, `paisley`; all old ids kept (`dharmaWheel` is now the light wheel). Om is hand-drawn; Ik Onkar (Noto Serif Gurmukhi Bold) and Allah (Amiri Bold) are OFL outlines in `glyphs.ts` (replaces "No Allah medallion"). Om, Allah, Allah medallion, Khanda and Jain carry COMMUNITY REVIEW. Picker 5 × 4 on phones, 10 × 2 from tablets; the dialog groups by tradition. `/dev/motifs` and `e2e/motifs.spec.ts` run every symbol through the PDF writer (no warnings, matches PDFKit). **Open:** the owner finds the symbols still short of expectations, Ganesha above all; next: "Use your own picture" for the top and openly licensed / public-domain artwork (never stock or competitor files, whose watermarks and metadata must not be removed).
- **Fixed 2026-11-22 (with 3.3):** values typed in another script now print in that script's font; see "Values in another script" under Phase 4.

### Step 2.3: Family members and sample profile (built 2026-11-22)

- **Built:** pure edits `addMember`, `editMemberRelation`, `moveMember`, `removeMember`/`insertMember`, `locateMember`, `setPhoto` (`src/biodata/edits.ts`). Each member row has a ⋯ menu (Change relation…, Move up/down, Hide/Show, Remove with confirm and Undo). `MemberDialog`: Add a family member / Add a reference / Change relation, with 19 relation pills (`RELATION_KEYS`) or a typed relation; typing a suggestion's name counts as picking it.
- **D44:** member details accept line breaks (Enter adds one) and print one line per number; References can hold several contacts. The same relation may be added twice (two elder sisters).
- **Sample:** `createSampleProfile()` (fresh ids); "Open a sample" in the drafts menu always creates a new draft and never touches the open one.
- **Completion:** `profileCompletion()`, "Your biodata is N% filled" in the rail, rounded down; hidden lines and hidden sections don't count.
- **Deviations:** there is no empty-draft state, so the sample is offered only in the drafts menu; the percentage shows only with the rail (≥ 1024 px), not on phones and tablets; "(Late)" is typed as part of the relation; no new relation keys. Built by one subagent together with 3.1's editor integration.

### Step 2.4: Simple and Detailed forms (built 2026-11-22, VISION D50)

- **Built:** `options.formLayout: "simple" | "detailed"` (`FORM_LAYOUTS`). New drafts are Simple (`createProfile({ formLayout })` can ask for Detailed); the sample stays Detailed. `SIMPLE_SECTIONS` / `layoutSections(layout)` in defaults.ts: Personal details (Name, Date of birth, Time of birth, Place of birth, Nakshatra, Rashi, Caste, Gotra, Maternal gotra, Height, Qualification, Occupation, Annual income), Family (Father, Mother), Contact (Phone, Address), Partner preferences (Expectations); same section keys as Detailed, so headings print in all ten languages. `FormLayoutSwitch` (a `SegmentedControl`, new `describedBy` prop) above the Top card with one line explaining the current form; 44 px touch targets; arrow keys switch.
- **Switching:** pure `setFormLayout(profile, layout, newId, now)` and `undoFormLayout(profile, before, after)`, Undo in the editor's toast (6 s). A field the current layout placed (in its home section there) moves to its home in the other layout, keeping id, value, option, visibility, label and note (a tradition chip's field: its own section in Detailed, Personal details in Simple). The other layout's missing sections are added at their default places and its missing default fields added empty; default fields follow the layout's order, the user's own fields stay before the default field they preceded. Going to Simple removes only Detailed default fields that are empty and untouched and still where Detailed put them, and a default section only if it ends up empty, shown and not renamed. Family lists keep every member; custom sections, References and chip fields always stay; a hidden section is left exactly as it is.
- **Undo** restores the exact previous sections and options if nothing changed since the switch, else switches back (keeping edits typed meanwhile).
- **Other edits follow the layout:** `sectionDefOf(section, layout)`, Restore default fields, `missingDefaults`, `addCatalogField`, `addPresetSection`, `availablePresetSections`. In Simple, Add a section offers About me, Religion, Horoscope, Education, Career, Family background and References, each saying what it comes with (`presetFieldKeys`). Tradition chips: Religion, else Horoscope, else Personal details (after the rows).
- **Decisions:** no schema version bump: `formLayout` is `z.enum(...).default("detailed")`, so drafts saved before D50 open as Detailed. Completion counts the fields present (new Simple draft 18 lines, Detailed 51). Help "Fill in your details" updated.
- **Deviations:** chip fields are never removed by a switch (so Detailed → Simple → Detailed restores them). Without memory two cases can't round-trip exactly: a field the user moved to exactly where Simple puts it goes back to its Detailed home, and a custom field between default fields may end up at the end of that run. Re-made empty fields get new ids.

### Step 2.5: App colour polish (built 2026-11-22, VISION D51)

- **Built:** Day and Night gradient tokens in `globals.css` (`--brand-gradient`, `--brand-gradient-hover`, `--accent-text`, `--accent-strip`, `--tile-gradient`, `--page-wash`) with utilities `bg-brand-gradient(-hover)`, `bg-tile`, `bg-page-wash`, `accent-strip`, `text-accent-gradient` (falls back to `--brand-ink` without `background-clip: text`, `CanvasText` in forced colours). Primary buttons: maroon → deep rose (Night amber → warm gold), deeper on hover, flat and faded when disabled; secondary, ghost and danger unchanged. Recipes `accentCard` (a 3 px maroon → rose → gold strip inside the card's top border) and `accentTile` (soft brand → gold tile) in `card.ts`, used on the Top, Photo and section cards; section headers carry their rail icon in a 36 px tile; hidden sections drop the strip and grey the tile. Add a section's picks, `EmptyState` and the landing headline accent (maroon → rose → gold; Night gold → amber, replacing the old rose/pink) follow. A barely visible warm wash at the top of every page.
- **Contrast (AA):** white on the Day button 9.2 / 6.7:1 (hover 11.2 / 8.5); dark text on the Night button 7.4 / 10.1:1; headline accent ≥ 4.06:1 Day, ≥ 7.05:1 Night (large text only); `src/app/theme-colours.test.ts` checks every stop in both themes.
- **Decisions:** colours only, no layout changes beyond the section-header tile; no glow, gloss or new fonts; small cards, notes, dialogs, the preview pane and the phone pill stay plain; the biodata page is untouched.

### Owner's fixes during M1 preparation (2026-11-22)

- **Symbols from the owner's friend (2026-11-22):** the drawn symbols looked generated, so the top-of-biodata picker now also holds 30 pictures drawn for this project (`src/document/motifs/art/`, from `docs/references/icons/`, which stays git-ignored): line drawings recoloured gold at their native size (no upscaling), colour pictures (Venkateswara, Rama, illustrated Ganeshas) unchanged, and 14 symbols cut from the friend's sheet. All have the same visual size (the longer side of the artwork is 80% of the box). "Ganesha, classic" is now the first symbol under the id `ganesha`; the drawn Ganesha and Ganesha, ornate were removed (`ganeshaOrnate` stays a legacy id that shows it). Pictures reach the PDF through the same image path as the photo. The picker holds 47 symbols plus None, so its last row is no longer full. Venkateswara, Rama, Allah and the Jain and Khanda pictures await community review (D47). **Open:** the picker's 48 tiles are many for a small card (a "More symbols" fold could show the first 20); the colour pictures carry white backgrounds on tinted designs; several sources are 250 px, so large print sizes are softer than the vector drawings.

- **Photo in the preview:** a just-picked photo now shows in the live preview at once (the editor hands the preview the pictures given this session until autosave writes them); before, it appeared only after a frame change. e2e in `editor-photo.spec.ts`.
- **Tradition chips unselect:** `options.traditions` records the chips tapped (drafts saved before read them from their fields); a second tap on a ticked chip removes its empty, untouched fields that no other ticked chip uses and the form doesn't have by default (`traditionRemoval`, `removeTradition`), keeps anything typed and says so, with Undo both ways; chips are `aria-pressed` toggles. Tamil and Hindu – other (same fields) are no longer ticked together.
- **Names:** downloads are `<Full name> Biodata.pdf` (`… Biodata.jpg` for a one-page biodata, else `… Biodata - page n.jpg`), and the automatic draft name is "<Full name>'s biodata".
- **No Print button:** the owner dropped it (the PDF and images download directly). `printPages` and its strings are gone; `printFromBrowserMenu` still makes the true-size copy on `beforeprint`, so the browser's own Print prints only the pages (e2e).
- **One value column:** Classic rows beside the photo and full-width rows share one 11em label column (it used to widen to 15.5em below the photo, copied from the owner's original reference).

## Phase 3 — Photo and live preview

- **3.1** Photo: pick, validate, downscale (≤ 3000 px long edge), own cropper (drag, pinch, zoom slider, rotate) with a 3:4 or tall 2:3 frame, replace, remove, optional second photo, empty-state tips, and a low-resolution warning below ~200 dpi at the chosen frame size (VISION D12, D40, D47).
- **3.2** Document primitives, tokens, `toDocument`, `paginate` (with D31 Auto text size: try the template's sizes largest first until one page fits, floor 9 pt), the **Classic skeleton** (D34); **Classic Gold first**, matched against the owner's reference side by side (original foliage and Ganesha artwork, D21/D29), then Minimal Ivory; document labels en + te.
- **3.3** Preview pane (desktop sticky, tablet collapsible; on phones the floating Preview pill and bottom sheet with preview, design/colour chips, text size and Download / Share / Save image, VISION D45), zoom, fit, page count, template/colour/document-language pickers, text size (Auto, XS–XL) and label case (D31), title and motif pickers.

### Step 3.1: Photo (component built 2026-11-21; in the editor 2026-11-22)

- **Built:** `src/biodata/photo-crop.ts` (pure: clamp, pan, zoom around a point, rotate, `effectiveDpi`, CSS placement), `src/lib/photos.ts` (check, decode upright, ≤ 3000 px JPEG 0.9, `renderCrop`/`renderCropDataUrl`), `src/components/photo/` (`PhotoField`, `Cropper`, `CropImage`), dev-only `/dev/photo`, `e2e/photo.spec.ts`.
- **Crop:** frame centre in source fractions; zoom 1–5; quarter turns clockwise; the frame is always covered.
- **Input:** JPEG/PNG/WebP ≤ 25 MB; the picker lists only those (iPhone converts HEIC); a dropped HEIC is tried, then a clear message. Re-encoding drops EXIF/GPS (a privacy plus); transparent PNGs go on white.
- **Cropper** (our own, D12): drag, pinch, wheel, slider, ± and arrow keys, Rotate, Reset; transform-only rAF updates; React state set at gesture end; on phones the stage adapts to the screen height and Cancel/Done sit side by side.
- **Low-resolution warning** below 200 dpi at Classic Gold's printed width (53 mm for 3:4, 49 mm for 2:3), in the card and live in the cropper (D47).
- **Contract:** `PhotoField` emits `{ photo, put, delete }`, mapping straight onto `profile-repo` `save(…, { photos: { put, delete } })`; it opens the cropper after picking. The document gets `renderCropDataUrl(blob, crop, frame, printPixels(mm))` (a JPEG data URL).
- **Deviations:** second photo, photo pages and the horoscope chart wait for 4.2b; photo icons live in `src/components/photo/icons.tsx` (move to the kit later). Built by a subagent in parallel with 2.1.
- **In the editor (2026-11-22):** `PhotoCard` after the Top card, with Photo in the rail and the chips. `autosave.update(profile, { put, delete })` saves each picture in the same transaction as the profile; queued photo writes are cleared only by a save that succeeds. e2e: reload restores the photo, Remove deletes it, Change swaps it in one save, Duplicate copies it.
- **Document photo:** `src/lib/document-photo.ts`: `useDocumentPhoto(profile.photo, loadBlob)` → `{ photo?, ready }` for `<DocumentView photo>` (keeps the previous picture while a new crop is drawn; stable between redraws); pure `loadDocumentPhoto`, `documentPhotoKey`, `documentPhotoPixels()` (56 mm at 300 dpi = 661 px). `/dev/draft` shows the stored photo.
- **Deviation:** the photo is its own card, not in the Personal details header (mockup). `PhotoField`'s low-resolution warning still uses Classic Gold's frame size; pass `printWidthMm` per design in 3.3.

### Step 3.2: Document engine and first two templates (built 2026-11-21)

- **Built:** document dictionaries `src/i18n/doc/` en + te (Telugu drafted, unreviewed, 22 notes in `meta.reviewNotes` for the D47 native review; English fallback key by key); `toDocument`/`docTexts` (`src/biodata/document.ts`) and `format.ts`; `src/document/` (`tokens`, `blocks/`, `Page`, `paginate` (pure), `measure` (browser), `DocumentView`, `document.css`, `frames/Foliage`, `motifs/` Ganesha); Classic Gold and Minimal Ivory × 3 colours with a registry; dev-only `/dev/document` (19 variants, `window.__doc`); `e2e/document.spec.ts` (desktop).
- **Pagination:** blocks measured off-screen per text size; rows never split; headings and a section's last two items keep together; paragraphs split by lines (2-line orphan/widow); D31 Auto tries XL → XS, floor 9 pt.
- **Decisions:** XS 12 px … XL 15 px; Classic margins 88 px clear of the frame (56 px with a top element); the photo sits beside the first section that starts with rows; Minimal drops the name row (the name heads the page). Noto Sans only, no serif (the PDF needs the same TTFs); opacity and side borders avoided (simpler for the PDF writer).
- **Deviations:** `SAMPLE_PROFILE` takes 2 pages even at 9 pt (49 rows, 11 headings), so the one-page check uses a "short" fixture (education and work inside Personal, as real biodatas do). No List primitive yet (waits for D44 display styles); family rows reuse Row; a continued section doesn't repeat its heading.
- **Open:** native review of `te.json`; a section beside the photo taller than a page would be clipped. For 3.3: pass `DocumentView` a memoised `doc` (it re-measures when the object changes, keeping old pages until then); scale the page wrapper, never page widths. For 4.1: pages are `[data-page][lang]` (the display list works unchanged); Latin text and ₹ on Indic pages use the Indic font's Latin glyphs, so the writer must fall back per glyph to Noto Sans; the photo needs a JPEG/PNG data URL.
- Built by a subagent in parallel with Steps 1.3 and 1.4.

### Step 3.3: Live preview (built 2026-11-22)

- **Built:** one `DocumentView` (same measure and paginate as the PDF, D1) laid out from the draft as it's typed, in `src/app/editor/preview/`.
  - **Desktop (≥ 1024 px):** a sticky right column. Row 1: Preview + the four outputs. Row 2: Design ▾ (ten thumbnails in each design's real frame and colours, plus the open design's three colours), the printing language (the language notice's dialog), Text size ▾ (Auto or XS–XL; Normal or ALL CAPS). Pages fitted to the pane; footer "Fits on 1 page · A4" / "N pages · A4", "Page n of N" ‹ ›, zoom − / Fit · 57% / + (the middle button toggles Fit and 100 %).
  - **Below 1024 px:** a "Preview & download · N pages" pill (hidden while the on-screen keyboard is up) opens a bottom sheet (92 % high) on phones, a side sheet (≤ 40 rem) on tablets: pages fitted to the width, design strip, colours, text size, labels, the fit sentence and the four outputs. Closes with ✕, Esc, backdrop or a swipe down; the page behind is inert; focus returns to the pill.
- **Decisions:** edits reach the document after 250 ms (at most 1 s while typing continues; 900 ms while the phone sheet is closed); previous pages stay visible while re-measuring. The document model is compared by content, so a change that prints the same doesn't re-lay out. Only `.doc-pages` is CSS-scaled; DocumentView's measuring columns stay true size. The first layout waits for the photo. A new design starts on its first colour. ALL CAPS is disabled (with a note) for non-English pages. Auto names the size it chose. Preview pages are `aria-hidden` with a screen-reader summary. The kept/storage cards moved to the end of the form. New pure edits `setDesign`, `setColor`, `setTextSize`, `setLabelCase`; `Popover` added to the UI kit.
- **Deviations from the mockup:** two-row desktop toolbar (one row doesn't fit at 1440 px); colours inside the Design panel and label case inside Text size; design thumbnails are sketches in the real frames; the tablet uses a side sheet instead of a cramped side-by-side pane; no separate full-screen phone preview page (the sheet covers it); no "pinch to zoom" caption. **Not done:** the per-design photo frame default and per-design `printWidthMm` for the photo warning (4.4).
- The editor's first load grew from 327 to ≈ 365 KB gzip (DocumentView, templates and frames now load with it); the PDF engine is still lazy.

## Phase 4 — PDF and template collection

- **4.1** Download PDF (engine from 0.2), Share PDF, **Save/Share as image** (JPEG/PNG per page from the same display list, VISION D38), Print, filenames `<Full name> Biodata.pdf` / `<Full name> Biodata - page <n>.jpg` (owner's choice 2026-11-22; was `Marriage-Biodata-<FirstName>.pdf`), progress and error feedback, no main-thread freeze. **Ends with milestone M1:** the owner builds their own biodata in the app and compares the PDF with their reference.
- **4.2** All ten document dictionaries and fonts; script fixture PDFs regenerated and reviewed (VISION §15 PDF/script tests).
- **4.2b** Photo pages (up to 4 extra photos, 1/2/4 per page, inside the template frame) and the attached horoscope page (VISION D40, D41).
- **4.3** Designs 3–10 and their frame families (adds the Modern and Minimal skeletons, D34, D46).
- **4.4** The second photo on page 1 (deferred from 4.2b), designs 11–20, the motif library with glyph motifs converted to paths (D21, D45, D47), and three colour variants for every design. Visual direction (D51): soft gradient paper washes, deep festive variants with gold-gradient ornaments, arch frames, oval photo frames; vectors and linear gradients only.

### Step 4.1, part 1: the Download engine (built 2026-11-21)

- `src/pdf/` (lazy-loaded): the display list read from the laid-out pages → a HarfBuzz + pdf-lib PDF; the same list → canvas page images. API: `createPdf(root, { title?, onProgress? }) → Blob`, `createPageImages(root, { format, width = 2480, quality?, onProgress? }) → Blob[]`; filenames `pdfFileName`/`pageImageFileName` in `src/biodata/filename.ts` (sanitised).
- The spike's gaps are closed: the display list records alignment and justified lines, baselines measured per font (within 0.02 px), the whole font stack, spaces between runs (copy/paste keeps "పేరు : …"), italic and object-fit; gradient ids with colons resolve; non-JPEG/PNG pictures are converted.
- **Font fallback:** each Indic `@font-face` carries a `unicode-range` (the same list in `document.css` and `FONT_UNICODE_RANGE`, a test keeps them equal), so Latin, digits and ₹ come from Noto Sans at the same weight on screen, in the PDF and in the images (fixes light English labels on Kannada pages).
- **Checked:** `/dev/pdf` (every feature the writer must draw), `window.__doc.pdf(id)` on `/dev/document`, `e2e/pdf.spec.ts` (16 variants, files in `test-results/pdf/`); PDFKit renders side by side with Chrome: no differences in ten languages, both templates, short and long; copy/paste exact via ActualText (PDFKit's own extraction still shows pre-base vowels in visual order, as in the spike).
- **Sizes and timings:** one page 23–44 KB; JPEG page images 156–327 KB; first PDF 122 ms, warm 16–59 ms; CPU ÷4 under 190 ms; no other origin. Not in the first load of `/` (204 KB gzip) or `/editor` (327 KB gzip); loaded on demand ≈ 635 KB gzip.
- Spike code deleted (`src/pdf-spike/`, `/dev/pdf-spike`, `e2e/spike/`, `scripts/spike-vector.mts`); `docs/spikes/` stays as the record. Built by a subagent in parallel with 2.1 and 2.2.
- **Next (part 2):** done 2026-11-22, below.

### Step 4.1, part 2: Download, Share, Save image (built 2026-11-22; Print button removed the same day)

- **Built** (`ExportActions.tsx`, `export-files.ts`): **Download PDF** (`<Full name> Biodata.pdf`, e.g. `Vusirikala Hari Kiran Biodata.pdf`, since 2026-11-22; title "Marriage Biodata – <name>"); **Share PDF** only where `navigator.canShare({files})` (if Safari refuses because generating took too long, a toast offers a fresh "Share" tap; cancelling the share sheet isn't an error); **Save as image** menu: JPEG (default), PNG, Share as image where supported; one file per page, 2480 × 3508, `<Full name> Biodata.jpg` for one page, else `… Biodata - page n.jpg/.png`; **Print** `window.print()` (the browser's Ctrl+P also prints only the pages).
- **Decisions:** every output waits until the preview shows the latest edits. The engine reads a true-size off-screen copy of the laid-out pages (SVG ids renamed), not the scaled preview; e2e shows its images match the engine on `/dev/draft` (mean pixel difference < 0.5). `import("@/pdf")` on first use, warmed on pointer-over. One job at a time (buttons disabled, spinner); a toast after 300 ms with page progress, then success or error. Several images download 250 ms apart via `blob:` URLs (allowed by the CSP).
- **Deviation:** Share also shows on desktop Chrome for macOS, which supports sharing files.
- **Owner checks (real phones):** iPhone Safari: Share PDF / Share as image reach WhatsApp; two pages give two images; Print shows only the pages with the photo and no blank last sheet; the pill hides with the keyboard; swipe-to-close. Android Chrome: PDF and JPEG land in Downloads; share sheet works. Mac Chrome: Share PDF opens the system sheet.

### Values in another script (fixed 2026-11-22, Step 2.0 / 4.2 open items)

- **Fixed:** values in a script other than the page's (a Telugu name on an English page, Hindi on a Tamil page, Bengali or Gurmukhi anywhere) print in that script's Noto font on screen, in the PDF and in page images; before, the page stack sent them to a system font the PDF couldn't match.
- **Approach:** `textFontStack(lang, text)` (`src/document/scripts.ts`) gives every element that prints user text the page font, Noto Sans, then only the script fonts its text needs (undefined when nothing extra is needed): row labels and values, paragraphs, section titles, Minimal's name and subtitle, the Modern side panel. Page fonts stay first, so metrics and baselines don't change. `loadElementFonts` (`measure.ts`) loads each element's own stack, weight and characters before measuring, so only the faces drawn are downloaded. The PDF side already fell back per glyph through the element's stack with the same unicode-ranges at the run's weight; it now warns "No font draws …" for graphemes no font covers.
- **Decisions:** Noto Sans already draws the whole Devanagari block with glyphs identical to Noto Sans Devanagari (checked with HarfBuzz; `NOTO_SANS_SCRIPT_RANGE`, tested against the TTFs), so Hindi/Marathi elsewhere needs no extra font. Invocation lines and titles keep `mixedFontStack`. Headings drop letter spacing when they contain Indic text. Kannada pages: English labels were already bold since 4.1 part 1; now verified (e2e counts NotoSans-Bold glyphs).
- **Checked:** four mixed-script variants on `/dev/document` (Classic Gold en/kn, Minimal Ivory en, Modern Two-Column ta); Chrome and the PDF use the same fonts and glyph counts per element; Chrome, PDFKit and the page image compared side by side.
- **Limits:** scripts we ship no font for (Odia, Urdu/Arabic, also right-to-left, Ol Chiki, Meetei Mayek, emoji) show in a system font on screen and as missing-glyph boxes in the PDF; the help page now says so (adding Noto Sans Oriya is a candidate for 4.4). A heading mixing an Indic word with English loses the English letter spacing. In Modern on Tamil pages, long labels wrap and can leave the colon alone on a line (10em label column): polish in 4.4.

### Step 4.3: Designs 3–10 and their frame families (built 2026-11-22)

- **Built:** Kalyanam (thoranam, mandala watermark), Temple Bells (bells and diyas), Rangoli (kolam band), Paisley (tall 2:3 photo), Royal Maroon (mandala corners), Deepam (gold filigree on dark paper), Executive Navy and Modern Two-Column (Modern skeleton); each with 3 colours, a frame in `src/document/frames/`, in the registry (D46 order, Minimal Ivory last).
- **Classic skeleton as data:** `skeletons/classic.tsx` `classicSkeleton(look)` (Classic Gold's block list + margins, bar style solid/underline, photo size, title flourish); shared `blocks/TopElement` (motif, invocation, title, with 2.0's mixed-script fonts).
- **Modern skeleton** (D34): the side panel is a frame on every page; page 1's photo, name, designation · city and Contact are a fixed `Aside` (Contact only if ≤ 7 rows and 360 characters, else in the main column); the main column is the same on every page, so `paginate` is unchanged.
- **Frames** ported from the mockup's frames.js: opacity becomes paper-mixed solids, the radial gradient a linear one, compact paths (≤ 34 KB markup, 3.7–6.3 KB source); a unit test runs each through `svgToPdf` with no warnings.
- **Checks:** `designs.test` (registry, frames, WCAG AA for every palette, Modern layout and pagination); `/dev/document` +49 variants; document/pdf specs cover them; PDFKit renders match Chrome in English and an Indic language for every design; PDFs 19–43 KB.
- **Deviations:** no design preselects a motif (D21); title styles are flourish rules, no serif or script faces (Noto only); About me stays in the Modern main column, so the panel is empty below Contact; Classic Gold keeps its own view.
- **Weak spots:** the two Modern designs differ only in colour and the band; the partner-preferences list style waits for D44; Kalyanam's garland is a little sparse.
- Committed together with 2.0: the two parallel agents both edited shared document files (`DocumentView`, block views, fixtures), so the steps couldn't be separated cleanly.

### Step 4.2, part 1: document labels in ten languages (built 2026-11-21, ahead of 4.1)

- `hi`, `ta`, `kn`, `ml`, `mr`, `gu`, `bn`, `pa` dictionaries in `src/i18n/doc/` (every `en` key, the wording families use on biodatas, Gregorian months, AM/PM kept), all `reviewed: false` with 23–28 `reviewNotes` each for the D47 native review; `index.ts` registers them (plus `withEnglishFallback` for testing the fallback).
- `doc.test.ts`: exact key set per language, no empty values, no leftover English beyond an allowlist, script-block check, same `{placeholders}`, review status.
- `/dev/document` gains a short Classic Gold page per language (27 variants); screenshots checked: no missing glyphs or clipping; two Malayalam labels shortened to fit the label column ("വിവാഹ നില", "യോഗ്യത").
- Open: native review of nine dictionaries; Devak/Gan have no default field (custom fields); part 2 (script fixture PDFs regenerated and reviewed) follows 4.1. Kannada pages' English labels keep their bold weight (verified 2026-11-22).

### Step 4.4: Designs 11–20 and the second photo on page 1 (built 2026-11-22, VISION D51, D56)

- **Built (ten designs, D46 order; the registry now has all 20):** each is a skeleton, a frame in `src/document/frames/`, three colour variants and a registry entry; frames are compact ports of the mockup's own drawings (27–37 KB markup, under the 40 KB budget), every one through `svgToPdf` with no warning.
  - **Classic skeleton:** Baroque Gold (`Baroque`: filigree corners with fronds, gold double rule, cartouches; gold, maroon, deep navy), Peacock (`Peacock`: a fan of three feathers in each top corner, double border, lotus; teal, royal blue, deep emerald), Peach Filigree (`FiligreeBow`: light filigree corners and a ribbon bow; a new **outline** heading-bar style), Navy Rosette (`Rosette`: double border with rosettes and laurel sprigs; navy, maroon, forest green, each with gold), Floral Ivory (`Blossom`: five-petal blossoms and buds on sage stems; tall 2:3 photo), Watercolour Rose (`WatercolourRose`: roses in two corners, underline headings), Mango Grove (`WatercolourLeaves`: mango leaves and two mangoes), Mint Vines (`Vines`: a vine with gold buds on both sides).
  - **Sandalwood:** Classic with a large-name **letterhead** (`blocks/Letterhead.tsx`, `skeletons/letterhead.tsx`: invocation and motif if chosen, the title as a small kicker, the name in spaced capitals, designation · city, a double rule with a diamond; the Name row and any emptied section drop out); `frames/Sandalwood` (a sandal wash, quiet double rule, corner blossoms).
  - **Slate Brush:** Modern skeleton; `frames/BrushWash` makes the side panel a broad vertical brush stroke, with a second stroke over the top of the main column and a slim echo at the foot (no border).
- **D51 look, PDF-safe:** paper washes are linear gradients only. `frames/paper-wash.tsx` is a page-sized vertical gradient (tinted top and bottom); `frames/wash.tsx` makes watercolour without blur or opacity: a corner glow is a page-corner triangle whose gradient ends exactly on the paper colour along its long side (no edge), and washes are seeded wobbly blobs with paper-mixed gradients, always deeper than the glow. Text and labels pass WCAG AA on every wash and glow colour, not only on the paper (tested). Deep festive variants: Baroque navy, Peacock emerald.
- **Second photo on page 1 (D56):** optional, always tall 2:3, at 0.8 × the design's tall photo, printed only with a main photo (kept in the draft, with a note, if the main photo is removed). Classic places it beside the first later section of rows with at least 3 items (its column as wide as the main photo's, so heading bars line up; standalone if no such section); Modern low in the side panel (Contact stays there only up to 4 rows and 200 characters); Minimal beside the main photo. Blocks carry `second` and `DocumentView` hands them the second picture (`blockPhoto`), so every view draws it; measured and paginated like any block. Editor: "Second photo" at the foot of the Photo card (add, crop, change, remove with Undo) through the same one-transaction save; pure `setSecondPhoto`; drawn at 42 mm and 300 dpi. Backup, duplicate and delete already covered it (`photo-refs`).
- **Shared edits:** `Filigree` corner gains `outline`/`step` options and merged frond paths (Deepam unchanged); the `"outline"` bar style in `skeletons/classic.tsx` and `HeadingBar`; the design popover scrolls on short screens (20 designs); e2e design counts come from `DESIGN_COUNT` (fixtures), kept equal to `TEMPLATES.length` by a unit test; `document.spec` timeout 900 s (about 250 gallery variants).
- **Checks:** `designs.test` (registry order, a fixture per design, palettes AA on paper and washes, frames through the PDF writer and the size budget), `frames/florals.test`, `templates/sandalwood-slate-brush.test`, `document/second-photo.test` (all 20 designs: drawn once, never without a main photo, size, placement, pagination), `biodata/edits-second-photo.test`; `document.spec` (no photo overlaps text, frames or another photo), `pdf.spec` (one more embedded image with the second photo), `editor-second-photo.spec`. Every design reviewed on screen (English, Telugu and another Indian language, all colours, long pages 1–2, with two photos, the owner-style draft with photo, Ganesha, the Telugu trio and relaxed spacing) and as a PDF (PDFKit renders match Chrome; PDFs 23–59 KB). Fixed in review: sparse clusters and harsh washes in the watercolours, a Floral Ivory frame over budget, Peacock's sparse feathers, Navy Rosette's laurels reading as arrows (twice), Baroque's small cartouche, Sandalwood's missing double rule, the second photo's bar alignment, brush strands into Slate Brush's panel text.
- **Deviations:** title styles stay rules and diamonds (Noto only, no script "Biodata"); no oval or arch photo frames yet (the PDF engine has one corner radius per image; D51's oval frames wait); no Baroque watermark; Peach Filigree has no letterhead.
- **Weak spots:** Peach Filigree is the plainest; Watercolour Rose's top-left wash reads a little like a band; the dark variants barely show their wash; a short Classic section beside the second photo leaves white space under its rows; Slate Brush's panel is mostly empty below the name when Contact moves to the main column (the Modern skeleton's existing weakness); no persistent low-resolution warning for the second photo (only the cropper's).

### Step 4.2b: Photo pages and the attached horoscope page (built 2026-11-22, VISION D40, D41)

- **Built:** data: `photoPages` gains `include?`, `horoscopeChart` is `{ id, crop, include? }`, `MAX_EXTRA_PHOTOS` is 8 (no format bump; absent `include` = true); pure edits `addPhotoPagePhoto`, `insertPhotoPagePhoto`, `replacePhotoPagePhoto`, `removePhotoPagePhoto`, `movePhotoPagePhoto`, `setPhotosPerPage`, `setPhotoPagesIncluded`, `setHoroscopeChart`, `setHoroscopeIncluded`, and `src/biodata/photo-pages.ts` (frame per layout, what prints, page counts, chart title). Editor: a "More photos" card (`PhotoPagesCard.tsx`) after Photo in both forms with a rail entry and chip: include switches, several photos added at once, thumbnails with Replace / earlier / later / Remove (Undo), cropping in the layout's frame, Photos per page with layout drawings, and a horoscope chart item (add, replace, rotate, remove with Undo, include). Document: `src/document/photo-pages.ts` (pure cell and chart maths) and `PhotoPages.tsx` (real `Page`s in the design's frame; page numbers on; the chart heading through the design's block view), a `photoPages` prop on `DocumentView`, `TemplateDef.photoRadius`. Pictures: `src/lib/picture-store.ts`, `use-pictures.ts`, `picture-urls.ts` (blob: URLs plus a registry), `useDocumentPhotos`, `drawPicture`; `src/pdf/index.ts` embeds registered Blobs without fetching. The preview says "1 page of details + 3 photo pages + horoscope page · A4" (`page-status.ts`). Download PDF, Share, Save as image and the print copy include the extra pages when on; image names stay "<Full name> Biodata - page n.jpg".
- **Decisions:** frames by layout: 1 per page 2:3, 2 per page 2:3, 4 per page 3:4 (never by design, so a crop doesn't move when the design changes; a crop is pulled back to cover its cell at draw time); one cell size per layout on every page, a short last page keeps it and centres; two photos stack in a narrow Modern column. Page count, Auto size and relaxed spacing are decided on the details pages only (e2e: `data-doc-relax`, `data-doc-step` and the last block's position are identical with and without photo pages). `data-doc-pages` stays the biodata's own count; `data-doc-photo-pages` and `data-doc-chart-page` report the rest. Pictures are drawn at about 300 dpi for the largest cell (674 × 1011 px content box), JPEG 0.88, never upscaled; the key doesn't include the design. **Blob URLs plus a registry because the editor CSP's `connect-src 'self'` refuses `fetch(blob:)`: checked for real with `e2e/csp.spec.ts`, which adds the production header to `/editor`, proves a cross-site fetch and a blob: fetch are both blocked, then exports a PDF and page images with photo pages and sees no violation.** The first photo added makes 1 per page and printed; removing the last photo removes the group (Undo restores its settings). The chart is fitted whole (contain, never cropped) and can be rotated.
- **Deviations:** the second photo on page 1 is not built (needs per-design page-1 layouts; moved to Step 4.4); the low-resolution warning for page photos uses the largest cell, not the open design's; the cropper uses the existing frames (2:3 / 3:4); the chart is the stored image (≤ 3000 px), not redrawn smaller.
- **Measured** (Chrome, desktop, drawn grainy fixtures ≈ 2.4 MB each): add 8 photos 1–1.5 s, all drawn 2–3 s, PDF 0.6–1 s; PDF with 8 photos at 1 / 2 / 4 per page: 9.2 / 4.7 / 4.0 MB (landscape sources) and 17 / 4.4 / 3.8 MB (portrait sources); each distinct picture embedded once (e2e counts the image objects); JS heap 25 MB → about 25 MB after adding, 90 MB just after the PDF. PDF vs Chrome mean pixel difference 0.2–2.6.
- **Owner checks:** real 12 MP phone photos in the cropper; the PDF size with real photos; iPhone Safari share of a 9-page PDF.

### Step 5.1: Backup and restore (built 2026-11-22)

- **Built:** pure core `src/lib/backup.ts` (`buildBackup`, `buildBackupBlob` per-draft Blob parts with chunked base64, `backupFileName`, `parseBackup` with rejections `notJson | notBackup | tooNew | tooBig | invalid | empty`, `withOpenDraft`, `estimateBackupBytes`); browser side `backup-file.ts`, words in `backup-text.ts`; every picture reference of a profile in `src/biodata/photo-refs.ts` (main, second, photo pages, horoscope chart); repo `listForBackup` and `importDrafts(drafts, { mode, restoredName })` (one transaction per draft with its photos, typed per-draft results); `autosave.pendingPhotos()` so a backup holds unsaved typing and photos. UI: export dialog (all drafts or the open one, approximate size), restore dialog (pick or drop, preview with checkboxes, Add or Replace, result with Open links), items in the drafts menu, buttons on the storage card, the privacy page's links (`/editor?backup=download|restore`, so Google Tag Manager never touches the file flow) and its "Backup files" section, "Download a backup first" in both delete dialogs and on the quota message. The 1.3/1.4 "until 5.1" deviations are gone; help text corrected.
- **Decisions:** format `{ manifest: { app, formatVersion: 1, exportedAt, draftCount }, drafts: [{ profile, photos: [{ id, mimeType, width, height, data }] }] }`; limits file ≤ 100 MB, ≤ 200 drafts, ≤ 2 MB text per draft, depth ≤ 16, ≤ 32 pictures per draft, a picture ≤ 25 MB decoded and ≤ 8000 px long edge, type checked against magic bytes and size read from the header; control characters stripped, `__proto__` dropped; Replace matches by draft id only; photo ids always fresh; replaced drafts get revision + 1; "(restored)" only when the same id already exists; an empty `BACKUP_UPGRADES` table mirrors `migrate`.
- **Deviations:** the privacy page's links open the editor's dialogs instead of running them in place; no test makes a 100 MB export.
- **Owner checks:** restore on another browser or phone (iPhone Safari download and the picker accepting `.json`), a large real backup, whether the scrolling draft list feels fine on phones.

### Step 4.5: Owner's M1 polish (built 2026-11-22, VISION D53)

- **Dates:** pure `setDateFormat`; a "Dates" control (three radios with the draft's own date, month names in the printing language; all ten dictionaries complete, tested 10 × 12 × 2).
- **Telugu families' wording:** optional `options.labelStyle` ("standard" | "telugu", absent = Standard, no format bump); overlay `labelVariants.telugu` in `src/i18n/doc/en.json` (`reviewed:false`, `reviewNotes`) read by `labelTables(dict, lang, style)`, English pages only, a renamed label always wins; the form follows the style (`labels.ts`, `LabelStyleProvider`, `useLabelStyle()`). The panel "Text, labels and dates" has a one-tap "Style: Standard | Telugu families" line (`setStylePreset`); on phones and tablets "Labels and dates" opens in a dialog.
- **Images:** JPEG default quality 0.97 (`JPEG_QUALITY`, measurements in `src/pdf/index.ts`: Chrome subsamples colour 4:2:0 at every quality below 1, so the faint halo round thin gold text is not a quality matter; quality 1 gives 4:4:4 at 1.9–2.3 MB a page, not shipped); the Save as image menu says "The PDF is the sharpest copy. Images suit WhatsApp status and screens." and PNG is "Lossless, sharpest picture".
- **Relaxed spacing:** one-page documents with ≥ 3 % room left stretch their vertical gaps (row padding, gaps before and after headings, paragraph padding, the top element's gap and padding) by up to 1.5×, filling to 98.5 % of the content box; fonts, frames and the photo never change, two or more pages are untouched, Auto (D31) unchanged. Every gap goes through `relaxed()` (`tokens.ts`), a `calc()` on `--doc-relax` set by `Page`, so there is one layout for preview, print, PDF and images; `layoutDocument` measures once more at the cap and the pure `relaxFactor` / `blendMetrics` (`src/document/relax.ts`) derive the rest. Dev only: `/dev/draft?d=<id>&relax=0`.
- **Deviations:** `doc.test.ts` excludes `labelVariants` from a translation's key set; the overlay's review notes live in its own `meta`.
- **Owner checks:** confirm the Telugu spellings; compare a real phone's JPEG with the PDF; look at the relaxed page against your reference.

## Phase 5 — Backup and offline

- **5.1** Backup export/import (D8): preview, add-as-new or replace, validation, older-version migration; "download a backup first" offered before destructive actions.
- **5.2** Manifest, icons, service worker, offline e2e (network off after first load → edit → download PDF), privacy network e2e (D15).

### Step 5.2: Offline and privacy checks (built 2026-11-22, VISION D55)

- **Manifest:** `src/app/manifest.ts`: `id` and `start_url` `/editor` (the installed app opens without Google Tag Manager), `scope` `/`, standalone, short name "Biodata", the existing `public/icons/*` including the maskable one.
- **Service worker:** hand-written `public/sw.js`, filled after `next build` by `scripts/sw-build.mts` (`"build": "next build && node --import tsx scripts/sw-build.mts"`, still run as `npm run build`; pure rules in `src/lib/sw-precache.ts`). `VERSION` is a sha256 of every kept file plus the worker; `PRECACHE` lists every page except `/dev`, 404 and not-found, plus `_next/static/**`, fonts, icons, brand, favicon and the manifest (112 files, about 7.9 MB, 3.7 MB of it fonts). The build fails if `/editor`, the manifest, a font or the WebAssembly is missing.
  - Install keeps everything or fails (never "offline-ready" with half the files); hashed files are copied from the previous cache, the rest fetched with `cache: "no-cache"`; then `skipWaiting`. Activate keeps the newest two versions and claims.
  - Pages: network first (online users always get the latest deploy); offline, on a 5xx or after 3 s, the copy installed with that version (never overwritten at runtime; `?d=` is not part of the key). Static files: cache first, then the previous version's cache, then the network.
  - Ignored: other origins (GTM is never cached or passed through), `/dev/*`, non-GET, Range requests, `sw.js` itself, the router's `.txt` files. An unfilled worker (`VERSION "dev"`) deletes its caches and unregisters: also the kill switch.
  - Registered by `src/lib/service-worker.ts` from `Editor.tsx`: production builds only, never `/dev*`, after `load`, `updateViaCache: "none"`.
- **Editor:** the Storage card says "Works offline" only once the worker controls the page (which happens only after every file is kept). "Using X on this device" leaves out Cache Storage where the browser breaks the total down (Chrome's `usageDetails`). The card's Backup/Restore buttons sit side by side only when the card is ≥ 26rem wide (container query; they overflowed on tablets). Help FAQ "Does it work without internet?" now says yes; the privacy page explains the offline copy of the site's own files.
- **Headers:** `vercel.json` gives `/sw.js` `Cache-Control: no-cache` and its own strict CSP; the public rule excludes it. The editor CSP already had `worker-src 'self' blob:`.
- **Tests:** `src/lib/sw.test.ts` runs the real `sw.js` against a fake CacheStorage and network (routing, install, updates v1→v2→v3, an open editor's old files offline after an update, timeout and 5xx fallbacks, no draft id cached, the kill switch); `sw-precache`, `service-worker`, `manifest`, `vercel-config` and `storage-status` tests. `e2e/offline.spec.ts`: after the first load every font, both WebAssembly files and `/editor` are cached and no draft id is; offline (the worker's network too), reload, edit, Saved, PDF and two JPEGs; D15: loading, typing and exporting make only same-origin requests, the worker's included. Playwright blocks service workers for every other spec (`serviceWorkers: "block"`).
- **Decisions:** build-time precache instead of cache-on-first-use (the lazy engine, WebAssembly and fonts must be there for an offline PDF in any language); every font precached (A6 said "on first use"); `/`, `/help` and `/privacy` kept too, so the logo link and Delete all work offline (their cached HTML still holds the GTM snippet, which simply fails offline; the worker never touches it); an update takes over at once while the previous cache keeps open editors working.
- **Risks:** two deploys during one open editor session delete the oldest cache, so not-yet-loaded chunks could fail until a reload (drafts are safe in IndexedDB); the first visit downloads about 8 MB in the background; Vercel must run `npm run build` (plain `next build` leaves the worker unfilled, which only cleans up after itself).
- **Owner checks:** (1) Vercel: `curl -s <prod>/sw.js | grep '^const VERSION'` shows a hex value, not `"dev"`; `curl -sI <prod>/sw.js` shows `no-cache` and the strict CSP; the build log ends with "sw-build: … files kept". (2) Android Chrome: open `/editor`, wait for "Works offline", Install app, airplane mode, open from the home screen, edit, download a Telugu PDF and Save as image. (3) iPhone Safari: Add to Home Screen, airplane mode, edit, Download PDF (iOS keeps the home-screen app's storage separate from Safari's). (4) After the next deploy, with the editor open: edits still save and Download PDF works; a reload shows the new version. (5) DevTools → Cache Storage holds only `fwb-<hash>` and `fwb-meta`, no draft ids.

## Phase 6 — Polish and launch

- **6.1 Landing and search engines (D22, D26, D27):** the professional landing page modelled on Family Tree's and EnglishEasy's (hero with a real biodata picture and "Create my biodata" / "Continue editing", how it works, templates strip, privacy promise, languages, FAQ, footer with support link); `content.ts` (`TITLE`, `DESCRIPTION` ≤ 160 chars with a unit test, `FAQ` rendered and in `FAQPage` JSON-LD, `WebApplication` JSON-LD with price 0, `GOOGLE_SITE_VERIFICATION`); canonical and Open Graph metadata per public page; `robots.ts`/`sitemap.ts` index Production only; `GoogleTagManager` in the public layout with `gtmId()` unit tests; e2e `capture.spec.ts` takes clean screens → `docs/screenshots/` → `npm run images` rebuilds the landing WebPs, link preview and **social preview** from real screens; README gets the screenshots; `/templates` gallery and `/help` FAQ. Plus the D36 search structure: ten language landing pages with `hreflang`/`og:locale` alternates, five tradition pages, the image gallery, the "what to write in each part" guide, and the structured data list (no `HowTo`, no counters). Footer notice: a document tool only; it doesn't match or connect people (D35). E2e: the editor loaded from the landing page's button makes no third-party request.
- **6.2** Accessibility pass (WCAG 2.2 AA), phone QA, night-theme screenshots of every screen, PROJECT_GUIDE review.
- **6.3** Owner checks before launch: community review of the Khanda and Jain motifs and native-speaker review of the label translations (VISION D47); production checks on real devices, README deployment/rollback/troubleshooting, launch.

---

# Part D — Progress

| Step | What | Status |
|---|---|---|
| 0.0 | Prerequisites (owner): npm token, sandbox allowlist, Vercel project | npm token refreshed 2026-11-20. Sandbox: the existing allowlist entries (`npm run build`, `npm run dev`, `npm run test:e2e`, `npm run images`) work here. Vercel project still to do |
| 0.1 | Skeleton and static-hosting proof | Done 2026-11-21. Unit 15, e2e 16 (+8 phone duplicates of the screenshot spec skipped), A7 screenshots of 4 screens × 3 sizes × Day/Night reviewed (home hero centred until 6.1 brings the product shot; privacy aside fixed). Also added beyond the step: `robots.ts` (preview/local builds disallow all), `vercel.json` header unit test, `e2e/screens.spec.ts` (screenshots + 360 px overflow), HSTS and `X-Frame-Options` headers. Night follows the device until 1.1's theme menu. Owner: import the repo in Vercel, open `/`, `/privacy`, `/editor?d=abc` on the preview and check `curl -I <preview>/editor` shows the strict CSP; upload `docs/social-preview.png` in GitHub Settings → Social preview |
| 0.2 | PDF and Indian-script spike | Done 2026-11-21: **C chosen** (VISION D49, `docs/spikes/PDF_SPIKE.md`). Candidates A and C ran as parallel subagents; B and D in e2e. Unit 57, e2e 19 (+11 phone skips), including the spike specs (reference screenshots, display list, Chrome PDF, raster PDF + page images, C in the browser from the static build). A's code and `@react-pdf/renderer`/`@pdf-lib/fontkit` removed; C, D, the display list and the reference page stay in `src/pdf-spike/` until 3.2/4.1 move them. Found: harfbuzzjs needs a Turbopack alias for `module` (added); display-list gaps to close in 4.1 (text-align, exact baseline, spaces between runs, italic). Also: social preview now shows two biodata pages (owner asked for more than the icon). Owner: phone download/Share checks move to 4.1 (the spike page is dev-only) |
| 1.1 | App shell | Done 2026-11-21. Unit 182 (30 new), e2e 44 passed (+24 phone skips by design), A7 screenshots of 7 screens × 3 sizes × Day/Night reviewed by the agent and spot-checked (fixed: phone header overflow at 360 px, tablet dead space, tall cards on phones, duplicate coffee card, uneven gallery cards, sub-44 px footer links). See the Step 1.1 section for decisions and mockup deviations |
| 1.2 | Profile model | Done 2026-11-21 (built by a subagent in parallel with 1.1; committed first since it doesn't depend on it). Unit 71 in `src/biodata/`. Deviations: option lists by key, not stored; photo slots for D40/D41; see the Step 1.2 section. VISION gaps noted there (tradition chip contents, Partner preferences display style) |
| 1.3 | Persistence and autosave | Done 2026-11-21. Unit 248 at the time (incl. 3.2's in-progress tests), e2e: all 1.3 tests pass (8 new in `drafts.spec.ts`); screenshots of editor, saved, conflict, not-found and blocked-storage states at 3 sizes × Day/Night reviewed. Fixed during the step: Try again after a failed save now shows Saving… (test fails without the fix). See the Step 1.3 section |
| 1.4 | Drafts and storage status | Done 2026-11-21. Unit 304 at the time (55 new), e2e 92 passed (+36 skips by design); drafts menu, delete/rename/delete-all dialogs, editor, landing with Continue and privacy reviewed at 3 sizes × Day/Night (fixed: tablet aside cards two across). See the Step 1.4 section. **Phase 1 complete** |
| 2.0 | Editor opening: top element card, language notice, tradition chips | Done 2026-11-22 (committed with 4.3). Unit 512, e2e 148 passed (46 skips by design); top card, symbol and language dialogs and the printed page in en/te reviewed at 3 sizes × Day/Night. Paused overnight by the daily API budget and resumed. See the Step 2.0 section |
| 2.1 | Editor inputs | Done 2026-11-21. Unit 419 at the time (25 new), e2e 118 passed (6 new in `editor-inputs.spec.ts`); editor screens (sample and empty draft, desktop, 1180 px, tablet, phone, Day/Night, open combobox, conflict) reviewed (fixed: sticky chips, wrapping family details, cut rail names, duplicate phone hint, faint Night dots). See the Step 2.1 section |
| 2.2 | Field and section management | Done 2026-11-21. Unit 470 at the time (30 new), e2e 137 passed (45 skips by design); field/section menus, Move to section, Add a field/section, remove dialog, Undo toast, hidden and empty sections reviewed on phone and desktop, Day/Night (fixed: type cards wrapping, toast covering shots, phone keyboard opening on Add a section). See the Step 2.2 section |
| 2.3 | Family members and sample profile | Done 2026-11-22 (with 3.1's editor integration). Unit 537 (25 new), e2e 167 passed (49 skips by design; new `editor-family`, `editor-photo`); family list, member menu, add-member dialog, References with two numbers, photo card empty/filled, the 1180 px rail and printed pages with the photo reviewed on phone and desktop, Day/Night (fixed: a menu-name clash, a multi-line check measuring one element twice). See the Step 2.3 section |
| 2.4 | Simple / Detailed forms (D50) | Done 2026-11-22 (owner's request, before M1). Unit 614 (38 new), e2e 195 passed (61 skips by design; new `editor-layout.spec.ts`; specs needing Detailed-only sections call `switchToDetailed`). Switch at phone/tablet/desktop Day/Night, Detailed after switching with toast, Simple chips, filled Simple form, Add a section in Simple, phone sheet and the printed one-page Simple biodata reviewed (fixed: chips above Name in Personal details; the switch's line wrapping at 1440 px). See the Step 2.4 section |
| 2.5 | App colour polish (D51) | Done 2026-11-22. Unit 630 (9 new), e2e 196 passed (62 skips by design) at the agent's last run. Home, help, privacy, editor Simple/Detailed, preview pane and phone sheet, dialogs and /dev/ui reviewed at phone/tablet/desktop, Day and Night, against the pre-2.5 shots (fixed: the strip on hidden sections). The Top card got the strip and tile from the lead. See the Step 2.5 section |
| 3.1 | Photo | Component done 2026-11-21 (unit 419 at the time, 37 new; e2e 118 passed, 7 new on `/dev/photo`; photo screens reviewed at 3 sizes × Day/Night, fixed: Done off-screen on phones, 360 px overflow, Remove contrast in Night, slider focus ring). In the editor 2026-11-22 (committed with 2.3) |
| 3.2 | Document engine and first two templates | Done 2026-11-21 (ahead of Phase 2, since it depends only on 1.2). Unit 304 at the time (58 new), e2e 68 passed (+32 skips by design); document screenshots for both templates × en/te × short/sample/long/split reviewed (fixed: Minimal's header band, a third page on long variants, a lone row opening page 2, and a paragraph-split bug with blank lines that overflowed 167 px). See the Step 3.2 section |
| 3.3 | Live preview | Done 2026-11-22 (with 4.1 part 2 and the other-script fix, built by two agents in parallel). Unit 571 (25 new for 3.3/4.1, 34 for scripts), e2e 186 passed (60 skips by design; new `editor-preview`, `editor-download`); desktop Day/Night (pages 1–2, design and size panels, image menu, toast), 1180 px, tablet pill and side sheet, phone pill, sheet and image menu reviewed (fixed: toolbar wrap, toast over the form, cut design name, size panel off-edge, two racing specs). See the Step 3.3 section |
| 4.1 | Download, Share, image export, Print | Part 1 (the engine, `src/pdf/`) done 2026-11-21: unit 470 at the time (50 PDF/filename tests), e2e 137 passed; PDFs match Chrome in ten languages. Part 2 (editor buttons) done 2026-11-22 with 3.3: Download PDF, Share PDF, Save as image (JPEG/PNG, 2480 × 3508), Print. Owner: real-phone checks listed in the part 2 section |
| M1 | Owner's own biodata made with the app (VISION D29) | Done 2026-11-22: the owner made their biodata in the app and compared it with their reference; their comments were built as 2.4 (Simple / Detailed), the owner's fixes during M1 preparation, 4.2b (photo pages), 4.5 (dates, Telugu wording, sharper images, relaxed spacing) and D52 (Complexion). Next: 4.4 and 5.2 |
| 4.2 | Ten languages in the document | Part 1 done 2026-11-21 (labels for all ten languages, built by a subagent; unit 357 at the time, e2e 92 passed). Part 2 (fixture PDFs) after 4.1 |
| 4.2b | Photo pages and attached horoscope page | Done 2026-11-22 (owner: up to 8 photos, optional, switchable). Unit 855, e2e 261 passed (85 skips by design; new `editor-photo-pages.spec.ts` 13 tests and `csp.spec.ts`). Card at phone/tablet/desktop Day and Night (empty, filled, off, at the 8 cap), preview pages at 1/2/4 per page in Classic Gold plus Executive Navy, Deepam, Royal Maroon, Minimal Ivory and the Telugu chart page reviewed; the PDF matches Chrome. Fixed: icon-only Replace on phones, narrow-column stacking, flaky waits. Second photo on page 1 moved to 4.4. See the Step 4.2b section |
| 4.3 | Designs 3–10 and frame families | Done 2026-11-22 (committed with 2.0). 20 new unit tests; every design reviewed on screen and as a PDF (en + an Indic language). See the Step 4.3 section |
| 4.4 | Designs 11–20, second photo on page 1 | Done 2026-11-22 (three agents in parallel). Unit 985; e2e full suite on the combined tree (see the commit). All ten designs reviewed on screen and as PDFs, the second photo in all 20 designs and the Photo card at 3 sizes × Day/Night. See the Step 4.4 section. Still open from the outline: glyph motifs as paths (D47), oval photo frames (D51) |
| 5.1 | Backup and restore | Done 2026-11-22. Unit 131 new, e2e `backup.spec.ts` 14 specs on phone and desktop with the A7 screenshots reviewed (menu, export, pick, error, preview, replace, result, both delete dialogs, storage card, quota; fixed: a wrapping file name, and X/Escape not reloading after the open draft was replaced). Owner to check by hand: another browser or phone, iPhone Safari, a large backup. See the Step 5.1 section |
| 4.5 | Owner's M1 polish: dates, Telugu wording, sharper images, relaxed spacing (D53) | Done 2026-11-22. Unit about 25 new, `editor-style.spec.ts` (24 passes), five designs, ten languages and 76+ fixtures checked for relaxed spacing. See the Step 4.5 section |
| 5.2 | Offline and privacy checks | Done 2026-11-22. Unit 923 on the step alone (about 68 new: `sw.js` run against a fake CacheStorage, precache rules, registration, manifest, headers, storage usage); e2e `offline.spec.ts` 5 passed (+1 phone skip): offline reload, edit, Saved, PDF and JPEGs with the network off; D15 request log including the worker's own requests. Storage card offline line, privacy and help text reviewed at 3 sizes × Day/Night (fixed: tablet backup buttons overflowing; usage no longer counts the offline copy). Deviations: precache made at build time, every font precached, public pages kept. Owner: Vercel, Android install and airplane mode, iPhone home screen (see the Step 5.2 section) |
| 6.1 | Landing, search engines, gallery, help, pictures | Not started |
| 6.2 | Accessibility, phone QA, night theme check | Not started |
| 6.3 | Launch | Not started |
