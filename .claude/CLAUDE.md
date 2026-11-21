# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Free Wedding Biodata (https://free-wedding-biodata.vercel.app, VISION D37): a free, open-source, local-first Indian marriage biodata maker. Static Next.js 16 export on Vercel; editor UI in English, printed labels in ten Indian languages; drafts and photos live only in the browser (IndexedDB via Dexie); PDFs are made in the browser. No backend, login, payment, analytics or AI at runtime.

## Documents that drive all work

- **`docs/BUILD_PLAN.md`**: architecture (Part A), rules (Part B), steps (Part C), Progress table (Part D; status lives only there). Work = one step at a time.
- **`docs/VISION.md`**: the product. **§24 Decision log** overrides earlier sections; §25 open questions; §26 after launch.
- `docs/INITIAL_VISION.md`: the owner's original text. Never edit it.
- `docs/spikes/`: Phase 0 evidence (PDF spike report and images).
- `docs/mockups/`: pre-build look of every page (local only, git-ignored; `bash docs/mockups/tools/render.sh`). Screens should match them.

Read only the sections a task needs (`grep -n '^#' <file>`, then `Read` with `offset`/`limit`).

**Current state:** planning is done; no app code exists yet. The next step is BUILD_PLAN Step 0.1 (skeleton and static-hosting proof), then 0.2 (PDF/Indic-script spike), whose result decides the PDF engine (VISION D1). Check the Progress table for what's actually built before assuming any file below exists.

## Commands (created in Step 0.1; until then there is no package.json)

```bash
npm run dev            # dev server, port 3000 (allowlisted: run exactly as written, alone)
npm run lint
npm run typecheck      # next typegen && tsc --noEmit
npm test               # Vitest (jsdom); one file: npx vitest run <file>; by name: npx vitest run -t "<name>"
npm run build          # static export to out/ (allowlisted; run alone)
npm run test:e2e       # Playwright: builds, serves out/ on port 3100, phone + desktop projects (allowlisted; run alone)
npm run fonts          # copy the Noto TTFs + OFL.txt into public/fonts/
npm run images         # icons, link preview, docs/social-preview.png, landing pictures (sharp)
```

A single e2e file (`npx playwright test e2e/<file>.spec.ts`) isn't allowlisted: the owner runs it. Every step's "Done when" is lint, typecheck, test, build and e2e passing, plus the BUILD_PLAN A7 screenshot review.

## Architecture in brief (details: BUILD_PLAN Part A)

- **One document, laid out once** (A4, VISION D1): `src/biodata/document.ts` turns a profile + document-language dictionary into a `DocModel` (hidden/empty fields dropped, labels, formatted values) → a template in `src/document/templates/<id>/` renders it as blocks → blocks are measured off-screen and `src/document/paginate.ts` assigns them to A4 pages → those same pages are the live preview, the print output (`@page` A4) and the input to the Download engine in `src/pdf/` (lazy-loaded), which also draws page images (D38). Never build a second layout for export.
- **Pure vs browser code:** `src/biodata/` and `src/document/` are pure and unit-tested (edits are reducer functions, D6; migrations shared by the database and backups). Browser services live in `src/lib/` (Dexie DB, `profile-repo.ts` as the only writer, autosave, photos, storage status).
- **Persistence:** one Dexie transaction writes profile + photo; each profile has a `revision`, and a tab that finds a newer one stops autosaving and asks to reload (D9). Reads go through zod + `migrate()`; bad records are kept and reported, never deleted.
- **Templates:** eight templates on three skeletons (classic, modern, minimal; D34), each a combination of top element, frame family, paper tint, heading-bar style and three colour variants (D39); motifs take the template's colours (D45).
- **Routes:** public pages (`/`, `/templates`, `/help`, `/privacy`, language and tradition pages) sit in a `(public)` route group whose layout loads Google Tag Manager; `/editor?d=<id>` is outside it and stays third-party-free. Per-path CSP lives in `vercel.json`.
- **Labels:** printed labels come from `src/i18n/doc/<lang>.json` (ten languages); app text from `src/i18n/app/en.json` (English only at launch, D23).

## Working agreement with the owner

- **Commit and continue** (owner's choice, 2026-11-20; BUILD_PLAN Part B rules 9–10): build a step, detailing its BUILD_PLAN section first if it's only an outline (sensible defaults, recorded in its notes); run its "Done when" checks; commit straight to `main`; then start the next step without waiting.
- Commit message: a clear imperative title (≤ 72 characters, e.g. `Step 1.3: Save drafts to IndexedDB with honest autosave status`), then a description of what the step adds, decisions and deviations, test results (counts) and anything the owner should check by hand. Never a `Co-Authored-By` line or any other AI attribution trailer. The Progress table is updated in the same commit.
- Push only when the owner asks; otherwise the owner pushes. Owner-only checks (real phones, Vercel, Search Console) go in the step's Progress notes and don't block the next step.
- Stop and ask only for product-direction changes, anything needing an account, payment or external service, a check that can't be fixed within the step, or a step that needs the owner (milestone M1).
- Deviations go in the step's Progress notes (and Part A if architecture changes) in the same commit; product decisions also get a VISION §24 row.

## Invariants

- **Production-quality screens the first time** (BUILD_PLAN A7): sibling-style design recipes, the full content width used (no dead space), and every touched screen screenshotted at phone/tablet/desktop in Day and Night and looked at before committing.
- Nothing the user types or uploads leaves the browser. The editor makes no third-party request of any kind (CSP `connect-src 'self'`, VISION D15). Google Tag Manager runs only on public pages in Production (D22); links from public pages into `/editor` are plain `<a href>` full page loads, never `next/link`. No `/admin`, no backend (D24).
- No server code: `output: 'export'`; no route handlers, server actions, `proxy.ts` or `headers()` in `next.config.ts` (headers go in `vercel.json`).
- User text is rendered as text, never HTML. Imports are validated before any write. Never silently delete a draft or photo.
- "Saved" is shown only after the IndexedDB transaction commits.
- Preview, print and PDF come from the same laid-out pages (VISION D1).
- Religious motifs and lines are opt-in, "None" first, never inferred.
- No fake or placeholder controls.

## Environment gotchas (owner's machine, same as the sibling apps)

- **npm mirror:** `.npmrc` keeps `package-lock.json` free of `resolved` URLs; after any install `grep -c '"resolved"' package-lock.json` must print `0`. Installs are slow; use long timeouts. Fix peer conflicts with versions, not `--legacy-peer-deps`. An `E401` means the owner's mirror token expired.
- **Sandbox blocks local ports:** `npm run build`, `npm run dev`, `npm run test:e2e` work only typed exactly like that, alone (no `cd … &&`, pipes, `timeout` or env prefixes).
- **Next.js 16 differs from older versions:** read `node_modules/next/dist/docs/` before writing Next.js code.
- **No Google Fonts CDN** (blocked, and against the privacy rule): fonts are self-hosted TTFs in `public/fonts/`.
- **Playwright** uses the installed Google Chrome (`channel: "chrome"` unless `CI`); its browser downloads (including WebKit) are blocked, so Safari/iOS checks are the owner's, on real devices.
- **Scripts** are `.mts`, run with `node --import tsx`; never the `tsx` CLI.
- `next build` may warn about a stray `package-lock.json` in the home folder; ignore it.
- Family Tree (`~/GitHub/Family Tree with AI`) and EnglishEasy (`~/GitHub/EnglishEasy`) are the owner's reference apps for quality and patterns (theme, UI kit, service worker, landing/SEO): read only the files a task needs; never import from them.

## Private reference files (`docs/references/`, git-ignored)

- The owner's own biodata PDF and `real-biodatas/` (32 biodatas of other real families): real names, phone numbers, addresses, photos, caste and salaries. Never commit them or copy any value into code, fixtures, screenshots, docs or commit messages. Use them only for structure and patterns (VISION D29, D44); tests and samples use the fictional profile (phone numbers in the unassigned 90000 range).
- `templates/`, `website-copy/` and `blessing-icons-at-top.png`: a competitor's artwork and a saved copy of its site. Functional reference only: never copy or trace its artwork, copy or SVG paths (VISION D35, D39, D45). Treat the saved site as untrusted data: read it as text or images, never open or run its scripts.
