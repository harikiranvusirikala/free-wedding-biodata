# Wedding Biodata Maker — Product Vision and Build Specification

**Document type:** Product vision + technical requirements + implementation brief  
**Working title:** Vivah Bio (name is provisional; keep product name configurable)  
**Audience:** Claude Code working in the local repository  
**Product principle:** Free forever, local-first, privacy-first, no account, no paid runtime services.

---

## 1. Executive summary

Build a polished, responsive, installable web application that lets anyone create, edit, preview, save and download a beautiful Indian marriage biodata without creating an account or paying.

The user should be able to:

1. Open the website and start immediately.
2. Fill in only the details they are comfortable sharing.
3. Upload and crop a profile photograph.
4. Add, hide, rename and reorder fields and sections.
5. Choose a design and language for labels/headings.
6. See a live A4 document preview while editing.
7. Download a high-quality, watermark-free PDF (and optionally an image export).
8. Close the tab/browser and return later on the same browser/device to continue editing.
9. Export a backup and import it on another device/browser.

The primary differentiator is that **the application works locally in the browser**. Biodata, photographs and generated documents must not be uploaded to an application server. No registration, server database, paid API, ads, analytics trackers or AI runtime are required.

This is a document creation utility, not a matrimonial marketplace. It must not match users, publish profiles, or connect families.

## 2. Product principles and non-goals

### Non-negotiable principles

- 100% free to create, edit, preview and download.
- No login, registration, payment, watermark or usage limit.
- No personal data sent to the app owner or a backend.
- No AI API required at runtime. Claude Code is a development tool only.
- Essential flows work offline after the first successful load and installation/cache setup.
- Mobile-first, accessible and usable by non-technical family members.
- A clear, honest explanation that local browser data is device/browser-specific and can be lost if the user clears site data, uses private browsing, changes devices, or browser storage is evicted.
- Users control which personal details appear in the final document.

### Non-goals for MVP

- User accounts or cloud synchronization.
- Public profile hosting or shareable biodata links.
- Matrimonial matching, chat, recommendations or social features.
- Backend database, server-side photo storage or file uploads.
- Paid plans, subscriptions, watermarks or advertising.
- Runtime AI writing, translation or recommendations.
- Complex astrology calculations or horoscope matching. The MVP may collect/display optional horoscope values but must not calculate or claim compatibility.

## 3. Target users and primary use cases

- An individual creating their own marriage biodata.
- A parent or guardian preparing biodata for an adult family member.
- A relative or friend helping someone prepare a document.
- Users on phones who want to create and share a PDF through WhatsApp.
- Users who prefer English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali or Punjabi labels.
- Users with different religious, cultural or personal preferences who need optional, configurable fields and motifs.

Typical return journey: the user creates a draft, downloads a PDF, closes the site, and opens the same website weeks later to update salary, designation, address, photo or preferences. The latest draft and selected template should be restored automatically on the same browser profile and origin.

## 4. Core user journey

1. **Landing page:** Explain the free/private/no-login proposition. Primary CTA: “Create my biodata”. If local drafts exist, also show “Continue editing”.
2. **Start:** Create a blank profile or optionally load a clearly labelled sample/demo profile. The sample must never overwrite a user's draft.
3. **Editor:** Edit grouped sections in a clear form. Each field is optional unless explicitly marked otherwise (name is the only recommended required field).
4. **Photo:** Add, crop, reposition, zoom, replace or remove a picture. Photo remains on the device.
5. **Design:** Choose a template, theme colour and supported typography options.
6. **Preview:** See an accurate A4 rendering. The preview updates as the user edits.
7. **Download:** Generate a clean, watermark-free PDF. Clearly show success/error feedback.
8. **Resume:** On a later visit, restore local drafts and continue editing.
9. **Backup:** User can download a portable JSON backup, then import it elsewhere.

## 5. Information architecture and screens

Recommended fixed routes (keep routes compatible with static hosting):

- `/` — landing page, create/continue draft, template highlights, privacy explanation.
- `/editor` — editor and preview; use a query parameter or local draft selector for profile identity rather than requiring server-rendered dynamic profile routes.
- `/templates` — template gallery and previews.
- `/help` — practical help, backup instructions and FAQs.
- `/privacy` — privacy and local-storage explanation.

### Editor layout

**Desktop:** two-pane experience. Left: section navigation and editable fields. Right: sticky A4 preview with zoom, page navigation and template selection controls. Keep the preview large enough to inspect typography and spacing.

**Tablet:** collapsible editor pane and preview pane; avoid cramped side-by-side layouts at narrow widths.

**Mobile:** form-first flow with clear section navigation; provide a “Preview” full-screen mode and a persistent download action. Avoid forcing users to pinch-zoom the document to see it.

### Common UI elements

- Header: product logo/name, language selector, light/dark/system theme, drafts menu, help.
- Save status: “Saving…”, “Saved on this device”, or a clear error.
- Draft manager: create, rename, duplicate, open and delete drafts.
- Form section navigation with completion indicators (informational only; do not force completion).
- Preview toolbar: template, page size/orientation if supported, zoom, download PDF, print.
- Backup controls: export JSON, import JSON, clear local data.

## 6. Biodata data model and form sections

Use a versioned, typed data model. Do not represent the entire document as arbitrary unstructured HTML. A profile should contain stable IDs, data values, display metadata and template settings.

### Suggested default sections and fields

All fields are optional unless stated otherwise. Avoid making sensitive fields mandatory. Do not infer values from other fields.

| Section | Example fields |
|---|---|
| Profile | Full name (recommended required), preferred biodata title, gender (optional), profile photo |
| Personal details | Date of birth, age (derived only when requested), height, marital status, nationality, mother tongue, current city, native place |
| Religion and community | Religion, community, caste/sub-caste, denomination or other community detail — all optional and user-controlled |
| Horoscope | Birth time, birth place, Rashi, Nakshatra, Gotra/Gothram, Manglik, other custom horoscope fields |
| Education | Highest qualification, university, college, additional qualifications |
| Career | Occupation, designation, employer, employment type, work location, annual income (optional) |
| Family | Father's name/occupation, mother's name/occupation, siblings and their details, family type, family values |
| Family background | Native place, family origin, residence, other family information |
| About me | Personality, interests, hobbies, values, lifestyle, short introduction |
| Partner preferences | Preferred age range, education, occupation, location, values and free-form expectations |
| Contact | Contact person's name, relationship, phone, alternate phone, email, address |
| Custom sections | User-defined section title and fields |

Do not include a default complexion field. If a user adds such a field, treat it like any other optional custom field and never preselect a value.

### Dynamic field functionality

Users should be able to:

- Add a custom section.
- Add a field to any section.
- Rename a field label.
- Change a field's value and input type where sensible.
- Hide a field from the PDF without deleting its value.
- Remove a field after a confirmation prompt.
- Reorder fields and sections.
- Rename/reorder sections.
- Restore default fields for a section.
- Choose display style for supported fields (e.g. single line or multiline).
- Select whether a field is shown in the document.

Each custom field needs a stable ID, label, value, type, visibility flag, sort order and optional help text. The editor must not lose a value when a field is temporarily hidden.

### Repeated family members

Represent siblings and any repeatable family member details as arrays of objects with stable IDs, not as fixed “Brother 1 / Brother 2” fields. Allow add, edit, reorder and remove. In the PDF, render a compact list or table based on the selected template.

## 7. Template and design system

Launch with **8 well-crafted templates**, not dozens of shallow variations. Every template consumes the same profile schema; a template controls only layout, typography, colours, decorative assets and field grouping.

Suggested initial collection:

1. Classic Gold — traditional, restrained gold detailing.
2. Temple / South Indian — subtle ornamental border and warm neutral palette.
3. Sandalwood — minimal regional-inspired palette, no mandatory religious symbol.
4. Royal Maroon — elegant traditional style.
5. Executive Navy — contemporary professional style.
6. Minimal Ivory — clean typography and generous whitespace.
7. Floral Ivory — subtle floral decoration.
8. Modern Two-Column — compact, readable profile with photo.

Design requirements:

- Distinct visual identity; do not copy a competitor's exact layout, artwork, branding or trade dress.
- Provide colour variations where appropriate.
- Provide font choices only from fonts bundled with the app and cleared for redistribution.
- Allow photo/no-photo layouts.
- Allow optional top invocation/title and optional decorative motifs.
- Religious or cultural symbols, blessings and shlokas must be opt-in and editable. Never auto-infer religion or insert a symbol by default without a clear user choice.
- Layout adapts gracefully to missing fields. Empty fields and empty section headings must not appear in the PDF.
- No awkward blank gaps when many fields are hidden.
- Long names, long employer names, addresses and custom fields must wrap cleanly.
- Avoid clipping, overlapping text, tiny unreadable font sizes and decorative overload.

Create a reusable design token system: page dimensions, margins, colour tokens, type scale, spacing, border styles, photo frame sizes, section headings and divider styles.

## 8. Multilingual support

Initial UI/document label languages:

- English (`en`)
- Telugu (`te`)
- Hindi (`hi`)
- Tamil (`ta`)
- Kannada (`kn`)
- Malayalam (`ml`)
- Marathi (`mr`)
- Gujarati (`gu`)
- Bengali (`bn`)
- Punjabi (`pa`)

Language selection affects UI labels, section headings, field labels, help text and prewritten optional motifs. It must **not translate or modify user-entered values**. A user can use Telugu labels and type their employer name in English.

Store translations in separate JSON dictionaries with English fallback. Avoid hardcoding translated labels inside components. Add RTL-ready architecture only if a later language requires it; do not overbuild for MVP.

### Font and script requirements

- Bundle appropriately licensed static TTF/OTF fonts for each supported script where required.
- Do not use variable font files for PDF if the chosen renderer cannot handle them reliably.
- Test conjuncts, vowel signs, matras, punctuation, numerals and mixed-script text.
- Validate both browser preview and generated PDF for Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Gujarati and Punjabi.
- Ensure downloaded documents do not depend on remote fonts or network access.
- If the PDF engine cannot correctly shape a script, do not silently ship broken output. Use a proven fallback strategy and document any limitation.

## 9. Local-first storage and data safety

This is the most important technical requirement.

### Storage design

Use **IndexedDB through Dexie.js** for profiles, photos and structured data. Use `localStorage` only for small preferences such as theme and last-selected language. Do not store large photo data URLs in localStorage.

Suggested Dexie stores:

- `profiles`: id, name, schemaVersion, createdAt, updatedAt, profileData, selectedTemplateId, selectedLanguage, selectedTheme.
- `photos`: profileId, blob, mimeType, width, height, updatedAt.
- `appMeta`: key, value (for last-opened profile, DB migration metadata and non-sensitive preferences if needed).

You may use a separate store for template-specific settings if the model requires it. Keep the schema small and migrations explicit.

### Save and restore behaviour

- Update React/UI state immediately when the user edits.
- Debounce writes to IndexedDB (initial target: 300–500 ms).
- Save the latest complete profile atomically through one persistence service.
- Show “Saving…” and then “Saved on this device” only after the transaction succeeds.
- Do not show “Saved” before the IndexedDB write completes.
- Flush pending writes during route changes and `visibilitychange` where possible.
- Do not rely only on `beforeunload`; browsers may terminate a tab without allowing asynchronous work to finish.
- On startup, restore drafts and the last-opened draft.
- Handle failed reads, failed writes, corrupted records and `QuotaExceededError` with clear user messages.
- Never silently delete a draft or photo to free space.
- Use versioned IndexedDB schema and explicit data migration tests.

### Important browser-storage limitation

IndexedDB is local to the current browser profile and website origin. It does not sync across devices or browsers. Users can lose local data by clearing site data, using private/incognito browsing, changing devices, browser profile resets, or storage eviction. Storage persistence requests reduce some eviction risk but are not an absolute guarantee.

Therefore:

- Display a concise “Your drafts are saved on this device” explanation.
- Provide Export Backup and Import Backup.
- Encourage backup before clearing browser data or changing devices.
- Offer `navigator.storage.persist()` thoughtfully; never block use if rejected.
- Use `navigator.storage.estimate()` to display a helpful storage status where supported.
- Handle storage quota gracefully.
- Provide a “Delete all my local data” action with clear confirmation.
- The product must never claim that local storage is a guaranteed permanent backup.

### Backup format

- Export a versioned JSON file containing all profile data and associated photos (either safely embedded/encoded with defined limits or bundled in a zip with a manifest).
- Prefer a ZIP backup containing `manifest.json`, profile JSON and image assets to avoid excessive JSON/base64 memory overhead.
- Validate imported files before writing anything.
- Display a preview of imported draft names and timestamps.
- Let users choose whether to add as new drafts or replace matching drafts; never overwrite silently.
- Reject malformed/unsupported versions with an actionable message.
- Do not import executable content or HTML from backups.

## 10. Photo handling

- Accept JPEG, PNG and WebP initially; consider HEIC only after browser support is tested.
- Validate file type and reasonable file size before processing.
- Crop, zoom, reposition and rotate if feasible.
- Resize to a sensible maximum (e.g. 1200–1600 px long edge) while retaining enough resolution for a printed portrait.
- Keep the original only if needed for recropping; otherwise store a compressed processed Blob.
- Store photo Blobs in IndexedDB, not remote services.
- Allow photo removal and show the correct placeholder in templates.
- Revoke temporary object URLs when no longer needed.
- Do not upload photos or send them to telemetry.

## 11. Live preview and PDF generation

### Preview

- The preview must use the same layout logic and tokens as final export.
- Preview updates as the user edits, changes language, toggles fields, changes theme or selects another template.
- Provide zoom in/out and fit-to-page.
- Show page boundaries and page count.
- Support one or more A4 pages as content grows; do not squeeze everything into one page by shrinking text to unreadable sizes.
- Provide a print preview mode.

### PDF output

Primary goal: clean, print-ready A4 PDF with high-quality text and photographs, no watermark and no remote dependencies.

**Do a rendering proof-of-concept before committing to one PDF library.** Candidate: `@react-pdf/renderer` for component-based PDF layout. However, font embedding alone does not prove correct Indic shaping. Verify complex-script rendering, text wrapping, font weights, page breaks, selectable text and image quality with actual Telugu/Hindi/Tamil sample data.

Also evaluate browser-native HTML/CSS print (`@page`, print styles and `window.print()`) as a fallback. It can preserve browser text shaping and selectable text but may require the user to choose “Save as PDF” in the system print dialog rather than producing a silent one-click download. Do not represent this as one-click PDF download if it is a print-dialog flow.

Avoid using a low-resolution page screenshot as the default PDF strategy. If a raster fallback is offered for a script that cannot be shaped by the selected PDF engine, make the trade-off clear, render at print-quality resolution, and test file size and legibility.

### PDF acceptance requirements

- A4 page size, correct margins and print dimensions.
- No clipping, overlapping text or missing glyphs.
- Embedded/licensed fonts or another reliable offline font strategy.
- User-entered scripts render correctly, including conjuncts and diacritics.
- Text selectable/searchable where the renderer supports it.
- Photographs remain sharp and correctly cropped.
- Long content flows to additional pages gracefully.
- Empty fields and sections are omitted.
- Filename is sensible, e.g. `Marriage-Biodata-FirstName.pdf` (sanitize user input).
- PDF generation happens entirely client-side.

## 12. Recommended technology stack

Use the current stable, supported versions when implementation begins; do not pin stale versions from this document.

| Area | Recommendation | Notes |
|---|---|---|
| Framework | Next.js App Router with static export where practical | Familiar to the owner; no server features needed for MVP |
| Language | TypeScript | Strict type checking |
| UI | React | Client-side editor and preview |
| Styling | Tailwind CSS | Reuse existing conventions |
| UI components | shadcn/ui + Radix primitives where helpful | Keep dependencies lean and accessible |
| Icons | Lucide React | Consistent icon set |
| Form state | React Hook Form | Dynamic sections and validation |
| Validation | Zod | Validate profile data and imported backups |
| Browser DB | Dexie.js over IndexedDB | Structured persistent local drafts |
| Preferences | localStorage | Small, non-sensitive preferences only |
| Photo processing | Canvas API and Blob | Local crop/resize/compression |
| PDF | Proof-of-concept `@react-pdf/renderer`; compare browser print | Indic scripts must be tested before final choice |
| PWA | Web app manifest + service worker; evaluate Serwist compatibility | Cache app shell and required static assets |
| Tests | Vitest + Playwright | Unit, storage, PDF and end-to-end tests |
| Hosting | Vercel static deployment or Cloudflare Pages | Choose the simplest reliable static hosting after testing Next static export |
| CI | GitHub Actions | Lint, typecheck, unit tests, build, browser tests |

### Explicitly excluded from MVP

- MongoDB / Atlas
- Cloudinary or any remote image host
- Better Auth / Google OAuth / login
- Anthropic API / Gemini API / any runtime LLM
- Payment gateway
- Application API routes or server actions
- Server-side PDF rendering
- Analytics that collect profile data

### Static hosting and PWA note

Configure a static export if compatible with the chosen Next.js features and hosting target. Keep all essential editor, database, photo and PDF functionality in client-side modules. Do not add Next.js server actions, route handlers or runtime-only dependencies. Test a clean production static build and deploy it before implementing advanced PWA behaviour.

Use a service worker to cache the app shell, compiled assets, fonts and static template assets. Do not cache user profiles or photos in a network cache; they are already in IndexedDB. Keep caching rules narrow and versioned. Verify the app opens offline after the first successful visit. Service-worker integration must be tested against the actual Next.js build configuration; do not add a PWA plugin blindly.

## 13. Privacy, security and accessibility

- No biodata values, profile names, phone numbers, addresses or photos may be sent in requests to the app's servers.
- Avoid third-party analytics, session replay, external font CDNs and remote image services.
- Prefer self-hosted fonts and assets.
- Set a restrictive Content Security Policy compatible with the static app, and standard security headers at the hosting layer where available.
- Use safe text rendering; never render user-entered content as raw HTML.
- Sanitize filenames and validate imported data.
- Do not store secrets in the client bundle.
- No external AI service is called from the application.
- Add clear privacy/help explanations in plain language.
- Follow accessible labels, keyboard navigation, visible focus, sufficient contrast, semantic headings and touch-friendly controls.
- Support screen readers for form controls and save/export status.
- Respect reduced-motion settings.

## 14. Quality requirements

### Performance

- Fast landing page and editor startup.
- Avoid shipping every template's heavy assets to the initial page; lazy-load template previews where possible.
- Keep photos and PDF rendering memory use controlled.
- Do not freeze the editor while generating a PDF; move expensive preparation into a worker if profiling shows it is needed and the chosen library supports it.

### Reliability

- Autosave status reflects actual database transaction completion.
- Refreshing the page does not lose saved edits.
- Multiple drafts remain isolated.
- Import/export round-trips preserve profile content and photos.
- App updates must not destroy existing local drafts; migrations are mandatory.
- Offline access works after first load and service-worker activation.

### Browser support

Test current Chrome, Edge, Firefox and Safari on desktop and mobile. Test Android Chrome and iOS Safari explicitly. Explain unsupported capabilities rather than silently failing.

## 15. Testing strategy and acceptance criteria

The project is not complete until all the following pass.

### Functional tests

1. User can create a new draft without login.
2. User can edit all default field types.
3. User can add, rename, hide, reorder and delete custom fields/sections.
4. User can add and remove multiple sibling entries.
5. User can select a template without losing values.
6. User can switch document label language without translating entered values.
7. User can upload, crop, reposition and remove a photograph.
8. Live preview updates after field and design changes.
9. PDF omits hidden and empty fields.
10. PDF has no watermark or paid gate.
11. User can create multiple independent drafts.
12. Draft is restored after closing/reopening the browser on the same profile and origin.
13. Export/import preserves text, custom fields, template, language and photos.
14. User can delete a selected draft and clear all local data with confirmation.
15. All essential features work offline after app shell caching.

### PDF/script tests

Create fixtures with realistic sample content in English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali and Punjabi. Include long names, mixed English/Indic text, conjunct characters, diacritics, long addresses, long custom text and missing optional fields. Inspect generated PDFs visually at 100% and print scale. Also verify text selection where supported.

### Storage tests

- Simulate save failures and `QuotaExceededError`.
- Test data migration from the previous schema.
- Test malformed and older backup imports.
- Ensure import never silently overwrites.
- Verify photo Blob round-trip.
- Verify local drafts are not included in service-worker caches or outbound requests.

### End-to-end tests

Use Playwright for desktop and mobile viewports. Cover create → edit → auto-save → reload → restore → template change → PDF export → backup export/import. Include a test that turns off network after the first successful load and completes editing and PDF creation offline.

### Suggested quality gates

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- PDF visual/script fixture review before every release that changes fonts or PDF layout.

## 16. Implementation phases

Build in small, verified phases. Do not generate the whole application in one large pass.

### Phase 0 — Repository and rendering spike

- Inspect existing project conventions and choose app scaffolding.
- Confirm Next.js static export and the intended static host.
- Create a proof-of-concept A4 PDF for English and Telugu, then Hindi/Tamil.
- Compare `@react-pdf/renderer` and browser print output.
- Test font licensing and file size.
- Decide the PDF engine based on evidence, not assumption.

**Exit criteria:** A documented PDF decision, sample PDFs inspected, and static deployment proven.

### Phase 1 — Foundation and local persistence

- Create the app shell and responsive layout.
- Add theme, language preference and navigation.
- Define profile TypeScript types and Zod schemas.
- Implement Dexie database, schema versioning and migrations.
- Implement draft create/list/open/rename/duplicate/delete.
- Implement autosave and honest save status.
- Add storage quota/persistence status and local data deletion.

**Exit criteria:** Text profile survives reload and browser restart on the same browser profile; save failures are surfaced.

### Phase 2 — Editor and dynamic fields

- Build default sections and optional fields.
- Add custom section and custom field management.
- Add repeated sibling/family member controls.
- Add show/hide/reorder controls.
- Add form validation and user-friendly input handling.

**Exit criteria:** All default and custom fields can be edited and restored without data loss.

### Phase 3 — Photo and live preview

- Implement photo input and local crop/resize.
- Build reusable document layout primitives.
- Implement first two templates.
- Connect editor state to live A4 preview.
- Implement responsive mobile preview.

**Exit criteria:** Text/photo/design changes immediately reflect in a faithful document preview.

### Phase 4 — PDF and template collection

- Implement final PDF export using the Phase 0 decision.
- Add all eight initial templates.
- Add page flow, page count, zoom and print handling.
- Add multilingual font/script validation.

**Exit criteria:** High-quality, clean PDF export passes script and layout fixtures.

### Phase 5 — PWA, backup and offline

- Add manifest, icons and service worker.
- Cache app shell/assets safely.
- Implement ZIP/JSON backup export and validated import.
- Add offline/error states and storage guidance.
- Verify no personal data is sent to the app host.

**Exit criteria:** Offline editing and PDF export work after first load; backup can move a draft to another browser/device.

### Phase 6 — Polish and launch

- Accessibility and mobile QA.
- Playwright coverage across desktop/mobile.
- SEO landing page, FAQ and privacy page.
- Add final favicons, Open Graph image and app icons.
- Production static build and hosting configuration.
- Document deployment, rollback and troubleshooting.

**Exit criteria:** All acceptance criteria pass; app is usable without an account and all core capabilities are free.

## 17. Suggested repository structure

Adapt this to the actual scaffold, but preserve separation of concerns.

```text
src/
  app/
    page.tsx
    editor/page.tsx
    templates/page.tsx
    help/page.tsx
    privacy/page.tsx
    layout.tsx
    globals.css
  components/
    landing/
    editor/
    form/
    preview/
    templates/
    backup/
    common/
  features/
    biodata/
      components/
      schema/
      types/
      defaults/
      utils/
    editor/
    pdf/
    photos/
    drafts/
  lib/
    db/
      database.ts
      migrations.ts
      profile-repository.ts
    storage/
    validation/
    file-export/
  templates/
    classic-gold/
    temple/
    sandalwood/
    royal-maroon/
    executive-navy/
    minimal-ivory/
    floral-ivory/
    modern-two-column/
  i18n/
    en.json
    te.json
    hi.json
    ta.json
    kn.json
    ml.json
    mr.json
    gu.json
    bn.json
    pa.json
  styles/
  workers/
public/
  fonts/
  icons/
  templates/
  manifest.webmanifest
  sw.js (or generated service worker)
tests/
  unit/
  e2e/
  fixtures/
```

## 18. Data model sketch

Use a versioned profile object similar to:

```ts
export interface BiodataProfile {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  language: string;
  templateId: string;
  theme: {
    colorPreset: string;
    fontPreset: string;
  };
  sections: BiodataSection[];
  photoId?: string;
}

export interface BiodataSection {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  order: number;
  fields: BiodataField[];
}

export interface BiodataField {
  id: string;
  key?: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "number" | "phone" | "email" | "custom";
  value: string | number | null;
  visible: boolean;
  order: number;
  options?: string[];
}
```

This is a starting sketch, not a demand to force every field into one generic representation. Repeated entities (siblings) and strongly typed built-in sections may use richer discriminated types. The key requirements are stable IDs, versioning, no value loss when hiding fields, and a shared render contract for preview and export.

## 19. Product analytics and monetization stance

Do not add ad networks or third-party analytics in the MVP. The product should not track personal biodata creation. If basic aggregate usage measurement is ever considered, it must be opt-in/ privacy-preserving and must never capture form values, photos, profile IDs or document contents. The project is intended to remain free and sustainable through low operating cost, not through gating essential features.

## 20. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Browser data is cleared or evicted | Explain local-only storage; provide easy backup/export/import; request persistent storage when appropriate |
| User expects sync across devices | Explicitly explain device/browser scope; offer portable backup, not hidden cloud sync |
| Indic text renders incorrectly in PDF | Rendering spike and real-script fixture tests before selecting the PDF engine |
| One-page layout becomes unreadable | Permit graceful multi-page output; never shrink below readable sizes just to force one page |
| Large photos exhaust browser memory/quota | Resize/compress locally; store Blobs; handle quota errors |
| Next.js/PWA integration complicates static build | Prove static deployment first; add narrow service-worker caching after |
| Browser APIs differ | Feature detection, fallbacks and browser-specific E2E coverage |
| App update breaks old drafts | Versioned DB schema, migrations, import/export fixtures |
| Sensitive details exposed by optional motifs/fields | All fields and religious symbols opt-in; visibility controls; local-only processing |

## 21. Reference products and inspiration

Use these as functional inspiration only. Do not copy their exact designs, copywriting, assets, proprietary templates or branding.

- https://www.weddingbiodata.in/ — marriage-specific editor, photo, personal/family/contact sections, language labels, preview and template selection.
- https://www.theweddingbiodata.in/ — examples of traditional, horoscope and family customization.
- https://bandhan.app/ — useful local-first, no-login, auto-save and privacy-first product direction.
- https://www.trybiodata.in/ — multilingual browser-based document generation.
- https://github.com/harikiranvusirikala/Family-Tree-with-AI — owner’s existing Next.js/TypeScript/Tailwind/Zod/Claude project conventions; reuse patterns only where appropriate.
- https://github.com/harikiranvusirikala/EnglishEasy — owner’s free, guest-first, offline/PWA, no runtime AI direction.

## 22. Instructions to Claude Code

Before writing application code:

1. Inspect the existing repository, package manager, conventions, documentation and scripts. If this is a new repository, propose a minimal scaffold.
2. Read this complete document and turn it into a phased implementation checklist.
3. Identify uncertain technical decisions, especially Next.js static export/PWA compatibility and Indic-script PDF rendering.
4. Run the Phase 0 PDF and static-hosting proof-of-concept before building the full editor.
5. Recommend dependencies only when they solve a concrete requirement. Keep the dependency tree small.
6. Do not add a backend, database service, login, payment, AI API, analytics or image hosting.
7. Do not create fake buttons, placeholder download controls or non-functional template cards.
8. Implement one phase at a time. After each phase, run lint, typecheck, tests and production build; fix failures before proceeding.
9. Add tests alongside functionality, especially for persistence, custom fields, backup import/export and PDFs.
10. Keep the README, architecture notes, setup instructions and known limitations current.
11. Never claim local data is guaranteed permanent. Make the backup story clear in the UI.
12. Ask for confirmation only when a decision changes the product direction or requires an external account/paid service. Otherwise make a sensible, low-maintenance choice and document it.

### First response expected from Claude Code

Do not immediately generate the entire app. First return:

- A concise repository assessment.
- Proposed implementation plan mapped to the phases above.
- The static hosting/PWA approach.
- The PDF/Indic-font proof-of-concept plan and any technical risks.
- A lean dependency list.
- Any assumptions that need to be recorded.

Then implement Phase 0 and report its results before moving to Phase 1.

---

## 23. Definition of success

A person with no technical knowledge can open the website on a phone, create a professional marriage biodata, customize it, see exactly what they will download, obtain a high-quality watermark-free PDF for free, close the browser, and later return on the same device/browser to make corrections — without signing up, paying, uploading personal data or needing AI.

**The best version of this product is a useful, dependable document tool that costs almost nothing to operate and respects the privacy of the families using it.**
