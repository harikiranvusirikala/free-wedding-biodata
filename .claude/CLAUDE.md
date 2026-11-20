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

## Working agreement with the owner

- **Commit and continue** (owner's choice, 2026-11-20; BUILD_PLAN Part B rules 9–10): build a step, detailing its BUILD_PLAN section first if it's only an outline (sensible defaults, recorded in its notes); run its "Done when" checks; commit straight to `main`; then start the next step without waiting.
- Commit message: a clear imperative title (≤ 72 characters, e.g. `Step 1.3: Save drafts to IndexedDB with honest autosave status`), then a description of what the step adds, decisions and deviations, test results (counts) and anything the owner should check by hand. Never a `Co-Authored-By` line or any other AI attribution trailer. The Progress table is updated in the same commit.
- Push only when the owner asks; otherwise the owner pushes. Owner-only checks (real phones, Vercel, Search Console) go in the step's Progress notes and don't block the next step.
- Stop and ask only for product-direction changes, anything needing an account, payment or external service, a check that can't be fixed within the step, or a step that needs the owner (milestone M1).
- Deviations go in the step's Progress notes (and Part A if architecture changes) in the same commit; product decisions also get a VISION §24 row.

## Invariants

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

## Private reference files

`docs/references/` holds the owner's real biodata PDF (real names, phone numbers, address, photo). It is git-ignored and must never be committed, copied into code, fixtures, screenshots, docs or commit messages. Use it only to match layout and structure (VISION D29); tests and samples use a fictional profile with the same shape.
