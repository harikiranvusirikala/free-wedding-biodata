# Wedding Biodata Maker — Product Vision and Build Specification

**Document type:** Product vision + technical requirements + implementation brief  
**Product name:** Free Wedding Biodata (D37; kept in one constant so it can change)  
**URL:** https://free-wedding-biodata.vercel.app  
**Audience:** Claude Code working in the local repository  
**Product principle:** Free forever, local-first, privacy-first, no account, no paid runtime services.

**How to read this file.** This is the product's source of truth. [INITIAL_VISION.md](INITIAL_VISION.md) is the owner's original text and is never edited. **§24 Decision log** records decisions made since; a later row overrides any earlier section it names. How the app is built (architecture, steps, progress) lives in [BUILD_PLAN.md](BUILD_PLAN.md).

---

## 1. Executive summary

**Identity (D37, owner's choice 2026-11-20):**

| | |
|---|---|
| App name | Free Wedding Biodata |
| URL | https://free-wedding-biodata.vercel.app |
| SEO title | Free Wedding Biodata Maker – Marriage Biodata PDF & PNG (D42; was “… – Create & Download Biodata PDF”) |
| Homepage H1 | Free Wedding Biodata Maker |
| Short description (on the page) | Create a beautiful wedding biodata online for free. Add your personal, education, career, family and horoscope details, customize the design, and download a high-quality PDF or PNG. (D42) |
| Meta description (≤ 160 characters) | Create a free marriage biodata online in minutes. Pick a beautiful design, add your photo and details, and download a high-quality PDF or PNG. No login needed. (159 characters, D42) |

Build a polished, responsive, installable web application that lets anyone create, edit, preview, save and download a beautiful Indian marriage biodata without creating an account or paying.

The user should be able to:

1. Open the website and start immediately.
2. Fill in only the details they are comfortable sharing.
3. Upload and crop a profile photograph.
4. Add, hide, rename and reorder fields and sections.
5. Choose a design and language for labels/headings.
6. See a live A4 document preview while editing.
7. Download a high-quality, watermark-free PDF, and on phones share it straight to WhatsApp or any other app (§24 D3). Also save or share each page as an **image (PNG/JPEG)**, e.g. for a WhatsApp status (D38).
8. Close the tab/browser and return later on the same browser/device to continue editing.
9. Export a backup file and import it on another device/browser.

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
7. **Download:** Generate a clean, watermark-free PDF. Clearly show success/error feedback. Where the device supports sharing files, also offer **Share PDF** (D3). **Save as image** gives one PNG/JPEG per page, also shareable (D38).
8. **Resume:** On a later visit, restore local drafts and continue editing.
9. **Backup:** User can download one portable backup file (JSON, photos included; D8), then import it elsewhere.

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

- Header: product logo/name, light/dark/system theme as **Day / Night / Follow device** like the sibling apps (app chrome only; the document is always printed on a light page), drafts menu, help. No app-language selector at launch: the editor UI is English-only (D23); the selector arrives with the first reviewed translation.
- Save status: “Saving…”, “Saved on this device”, or a clear error.
- Draft manager: create, rename, duplicate, open and delete drafts.
- Form section navigation with completion indicators (informational only; do not force completion).
- Preview toolbar: template, colour, **document language** (separate from the app language, §8), zoom, page count, Download PDF, Share PDF (where supported), Save as image, Print.
- Backup controls: export backup, import backup, clear local data.

## 6. Biodata data model and form sections

Use a versioned, typed data model. Do not represent the entire document as arbitrary unstructured HTML. A profile should contain stable IDs, data values, display metadata and template settings.

### Suggested default sections and fields

All fields are optional unless stated otherwise. Avoid making sensitive fields mandatory. Do not infer values from other fields.

| Section | Example fields |
|---|---|
| Profile | Full name (recommended required), preferred biodata title, gender (optional), profile photo |
| Personal details | Date of birth, age (derived only when requested), height, marital status, nationality, mother tongue, current city, native place |
| Religion and community | Religion, community, caste/sub-caste, denomination or other community detail — all optional and user-controlled |
| Horoscope | Birth time, birth place, Rashi, Nakshatra and its pada (quarter, e.g. “Pushyami (3rd pada)”), Gotra/Gothram, maternal Gotra, Manglik, other custom horoscope fields |
| Education | Highest qualification, university, college, additional qualifications |
| Career | Occupation, designation, employer, employment type, work location, annual income (optional) |
| Family | Family members as a free list of **relation : details** rows (Father and Mother pre-added; Brother (Elder), Sister-in-law, Grandfather, Father-in-law… added freely), family type, family values |
| Family background | Native place, family origin, residence, other family information |
| About me | Personality, interests, hobbies, values, lifestyle, short introduction |
| Partner preferences | Preferred age range, height range, education, occupation, location, values and free-form expectations |
| Contact | Contact person's name, relationship, phone, alternate phone, email, address |
| Custom sections | User-defined section title and fields |

Do not include a default complexion field. If a user adds such a field, treat it like any other optional custom field and never preselect a value.

Field details settled for the MVP (D13, D14):

- **Age** is never stored. A “Show age” switch prints the age computed from the date of birth on the day the PDF is made, so it never goes stale.
- **Height** is picked in feet and inches (with centimetres shown alongside) and stored in centimetres; the document shows the format the user picks.
- **Dates** print as DD-MM-YYYY by default, with “15 March 1998” and “15-March-1998” options. **Birth time** is 12-hour with AM/PM.
- **Select fields** (marital status, Rashi, Nakshatra, family type…) always allow typing a custom value; lists only save typing.
- **Phone** values are free text with a format hint (Indian numbers with or without +91); validation never blocks saving.
- **Options follow the document language (D33).** A value picked from a list (e.g. marital status “Never married”) is stored as an option key and printed in the document language; anything typed is printed exactly as typed.
- **About me** and **Partner preferences** are optional paragraphs with an example placeholder showing what to write, printed as a short quoted block.
- **Starter field sets (D32).** When creating a draft the user may pick a starting set (General — the default — Hindu, Muslim, Christian, Sikh, Jain) that decides which horoscope/community fields are pre-added. It is an explicit choice, never derived from the Religion field, and every field remains editable or removable.

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
- **Move a field to another section** (real biodatas often put Education and Profession under Personal details, or Partner expectations under Contact).
- Restore default fields for a section.
- Choose display style for supported fields (e.g. single line or multiline).
- Select whether a field is shown in the document.

Each custom field needs a stable ID, label, value, type, visibility flag, sort order and optional help text. The editor must not lose a value when a field is temporarily hidden.

### Repeated family members

Represent siblings and any repeatable family member details as arrays of objects with stable IDs, not as fixed “Brother 1 / Brother 2” fields. Allow add, edit, reorder and remove. In the PDF, render a compact list or table based on the selected template.

**Decision D28:** the Family section is one list of **family members**, each `{ relation, details, visible }`. The relation is free text with suggestions (Father, Mother, Brother (Elder), Sister (Younger), Sister-in-law, Brother-in-law, Grandfather, Grandmother, Uncle, Aunt, Father-in-law…) and is printed as the row label; the details are free text (name, occupation, place, phone), printed as the value. This covers parents, siblings and wider family in one control, as real biodatas do.

Reordering uses **Move up / Move down** buttons (keyboard- and phone-friendly) rather than drag and drop (D7).

## 7. Template and design system

Launch with **8 well-crafted templates**, not dozens of shallow variations. *(Superseded by D46: 20 designs at launch, built from shared layouts and frame families.)* Every template consumes the same profile schema; a template controls only layout, typography, colours, decorative assets and field grouping.

Suggested initial collection:

1. Classic Gold — traditional, restrained gold detailing. **Modelled on the owner's own biodata (D29):** gold foliage in the corners joined by thin gold rules, an optional motif centred at the top, section headings as filled amber bars with bold dark uppercase text, labels in bold warm brown followed by “ :”, values in near-black, the photo top-right beside the first section with softly rounded corners, everything on one A4 page when the content fits. All artwork is drawn for this app.
2. Temple / South Indian (working name “Kalyanam”) — subtle ornamental border and warm neutral palette.
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

### Optional motifs and invocation lines (D21)

A small motif library drawn for this app (original artwork, simple vector paths so it prints crisply), plus an optional invocation/blessing line chosen from a list or typed freely. **Nothing is preselected and nothing is inferred from the Religion field.** The picker offers “None” first.

| Tradition | Example motifs and lines (all optional, all editable) |
|---|---|
| Hindu | Om, Ganesha (simple and ornate), Kalash, Swastika, lotus; “Shri Ganeshaya Namah” / “॥ श्री गणेशाय नमः ॥”; the Telugu trio “శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు” |
| Muslim | Crescent and star, an Allah calligraphy medallion; “Bismillah ir-Rahman ir-Rahim” |
| Christian | Cross; a short verse |
| Sikh | Ik Onkar (plain or in a circle), Khanda |
| Jain | Jain symbol (Ahimsa hand); Navkar mantra opening line |
| Buddhist | Dharma wheel (light and solid), lotus |
| Neutral | Floral, paisley, rings, none |

Lines are stored as the user's text once picked, so they can be edited and are printed exactly as shown. The document title is optional too (“Biodata”, “BIODATA”, “Marriage Biodata”, the localised equivalent, or custom text).

**Typography controls (D31):** text size **Auto** (the largest size in the template's range that fits everything on one page; only if the template's minimum readable size still doesn't fit does content flow to page 2) or a fixed XS–XL step; labels in Normal case or ALL CAPS. The minimum body size is 9 pt, so “fits one page” never means unreadable.

**Design vocabulary (D39), learned from the reference set** (the competitor's ten showcase designs, kept git-ignored in `docs/references/`, never copied): every template is a combination of —
- a **top element**: a motif, an invocation line, or a decorative script title (“Biodata”, “బయోడేటా”, “बायोडाटा”… in the document language), or nothing;
- a **frame family**: fine double line with flourished corners, foliage or vine, floral corners, paisley, a festive **thoranam/toran** of mango leaves and marigolds, watercolour corner washes, a rangoli/temple pattern band, hanging bells and diyas — or no frame;
- a **paper tint** (ivory, cream, blush, mint, sandal, white) and an optional faint **background watermark** (mandala or kolam) behind the text;
- **heading bars** in a light tint with dark text or a solid colour with light text, either full width or as wide as the text column beside the photo;
- a **photo frame**: 3:4 with a thin coloured border and soft corners, beside the first section.

The default section order follows what families read first: **About me** (if filled) → Personal details → Horoscope → Education & career → Family → Contact → Partner preferences; users can reorder. Each template ships with **three colour variants**, so eight templates give 24 distinct looks.

**Motif colour and titles (D45):** every motif takes the template's colours; title styles are “BIODATA” (spaced serif), script “Biodata” and the localized title, each between thin flourishes.

**Template construction (D34):** the eight templates are built on three shared layout skeletons (Classic: heading bars, label/value rows, photo beside the first section; Modern: two columns with a side panel; Minimal: typographic, generous whitespace), each with its own original border artwork, palette and type. This keeps eight templates consistent and cheap to maintain.

**Nothing but the user's content is printed (D35):** no site name, URL, watermark or “made with” line on the document, and no field is ever struck through or hidden behind payment. MVP pages are **A4 portrait**; landscape and other sizes come later.

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

**Two separate language choices (D11, D23).** The **document language** sets what is printed: section headings, field labels, date/month names, preset motif lines (about 150 short strings). The **app language** sets the editor's buttons, help and messages. They are independent: a parent may use the app in English but print Telugu labels. **Document labels ship in all ten languages. The editor UI ships in English only** (owner's choice, 2026-11-20); its strings still live in a dictionary (`src/i18n/app/en.json`) so translations can be added later without touching components. Each document dictionary records its review status; translations drafted by Claude are marked “not yet reviewed by a native speaker” until someone checks them, and the document-language picker says so until then.

### Font and script requirements

- Bundle appropriately licensed static TTF/OTF fonts for each supported script where required.
- Do not use variable font files for PDF if the chosen renderer cannot handle them reliably.
- Test conjuncts, vowel signs, matras, punctuation, numerals and mixed-script text.
- Validate both browser preview and generated PDF for Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Gujarati and Punjabi.
- Ensure downloaded documents do not depend on remote fonts or network access.
- If the PDF engine cannot correctly shape a script, do not silently ship broken output. Use a proven fallback strategy and document any limitation.
- Font source (D10): Noto Sans family (SIL OFL 1.1), static TTF files, Regular and Bold, one file per script. The Google Fonts builds of each Noto Sans *script* font also contain Latin, so mixed English/Indic values work inside one font. The **same TTF files** feed the browser preview (`@font-face` with `unicode-range`, so a phone only downloads the scripts it shows) and the PDF. Files live in `public/fonts/` with `OFL.txt`, copied there from an npm package by a script; nothing is fetched from Google at runtime.

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
- Show the last-saved time (“Saved on this device · 4:12 PM”).
- **Two tabs, one draft (D9):** each profile carries a `revision` number. If another tab saved a newer revision, the stale tab stops autosaving and offers “This draft was changed in another tab — reload it”, so neither tab silently overwrites the other.
- A profile and its photo change in **one Dexie transaction**, so a crash never leaves a draft pointing at a missing photo.
- Before destructive actions (delete a draft, delete all data, replace drafts on import) offer “Download a backup first”.

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

**Decision D8:** one versioned JSON file per export (`Biodata-backup-YYYY-MM-DD.json`) containing a manifest (app name, backup format version, export time), the selected profiles and each profile's photo as base64. Photos are already resized (D12), so a draft's backup is roughly 0.3–1 MB and the base64/memory overhead that motivated ZIP does not arise; one JSON file also avoids a ZIP dependency and is simpler to validate. Revisit ZIP only if real backups exceed ~25 MB.

- Validate imported files (Zod, size limits, MIME check of decoded photos) before writing anything.
- Display a preview of imported draft names and timestamps.
- Let users choose whether to add as new drafts or replace matching drafts; never overwrite silently.
- Reject malformed/unsupported versions with an actionable message. Older backup versions are migrated with the same migration functions as the database.
- Do not import executable content or HTML from backups. Unknown keys are dropped; all strings are treated as plain text.

## 10. Photo handling

- Accept JPEG, PNG and WebP initially; consider HEIC only after browser support is tested. (iPhones' photo picker hands the page a JPEG when the input's `accept` lists only JPEG/PNG/WebP, so most iPhone photos work without HEIC support.)
- Validate file type and reasonable file size before processing.
- Crop, zoom, reposition and rotate (90° steps) with our own small cropper (pointer drag, pinch and a zoom slider; no crop library).
- **D12:** store a downscaled **source** image (≤1600 px long edge, JPEG ≈0.9) plus a normalised crop (`x`, `y`, `zoom`, `rotation`). The cropped picture is drawn at render time, so re-cropping never loses quality. Every template's photo frame uses the same **3:4 portrait** aspect (D30; frames may round corners or use an arch shape inside it).
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

### Rendering architecture (D1, confirmed by the Phase 0 spike: D49)

**One document, laid out once, by the browser.** Each template is an HTML/CSS component that lays the biodata out into fixed A4 page boxes (sizes in mm, from the design tokens). Block-level pagination (header, section headings, rows, paragraphs split at line boundaries) distributes content across pages, never shrinking text below the template's minimum size. Those page boxes are, at the same time:

1. **the live preview** (scaled to fit the screen),
2. **the print output** (`@page { size: A4; margin: 0 }`, one box per sheet), and
3. **the source of the downloaded PDF.**

The browser already shapes every Indian script correctly (HarfBuzz in Chrome/Firefox, CoreText in Safari), so preview text is right by construction, and “see exactly what you will download” holds because there is only one layout.

For **Download PDF** the spike compares:

| | Candidate | Strengths | Concerns to test |
|---|---|---|---|
| A | `@react-pdf/renderer` (separate PDF components) | One-click, vector, selectable | Its fontkit-based shaping has a history of Indic bugs (reph, pre-base matras, conjuncts); needs a second layout for the on-screen preview, or pdf.js to display it (Android Chrome cannot show PDFs inline) |
| B | Browser print only (`window.print()`) | Perfect shaping, vector, selectable, zero code | Print dialog, not a download; many steps on phones before WhatsApp |
| C | **Vector PDF from the laid-out pages**: read line boxes from the DOM, shape each line with HarfBuzz (`harfbuzzjs`, WebAssembly) using the same TTF, write glyphs, boxes, images and SVG ornaments with `pdf-lib` | One-click, vector, selectable (ActualText), identical to preview, works offline | Our own ~1k-line renderer limited to the CSS subset templates use; shaping must match the browser; wasm size |
| D | Raster: pages drawn to canvas at 300 DPI, wrapped in a PDF | Simple, perfect shaping | Not selectable, larger files, Safari's SVG-foreignObject font quirks |

**Expected outcome (hypothesis, not a decision):** C for Download/Share, B offered as “Print”, D kept only as an emergency fallback. A is tested because §11 named it, and adopted only if it shapes all ten languages correctly **and** a single-layout preview remains possible.

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

### Image export (D38)

- **Save as image** produces one image per page: JPEG by default (small enough for WhatsApp), PNG on request, A4 at 2480 × 3508 px (300 dpi, print quality), so it prints as sharply as the PDF and text stays crisp when zoomed on a phone (under the 16.7-megapixel canvas limit of older iPhones). Files are named `Marriage-Biodata-FirstName-page-1.jpg`.
- It is drawn from the **same laid-out pages and the same shaping** as the PDF (the Download engine's display list drawn onto a canvas), never a separate layout, so the image and the PDF match.
- Where `navigator.canShare({ files })` is true, **Share image** sends the page image(s) straight to WhatsApp (status or chat); elsewhere the image downloads.
- Entirely client-side, no watermark, no site name, same omission of hidden/empty fields as the PDF.
- PDF generation happens entirely client-side.

## 12. Recommended technology stack

Use the current stable, supported versions when implementation begins; do not pin stale versions from this document. The table below is the **decided** stack (2026-11-20); the original recommendations it replaces are in INITIAL_VISION.md, with reasons in §24.

| Area | Decision | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, `output: 'export'` | Same version line as the sibling apps; no server code can exist in a static export (D4) |
| Language | TypeScript, strict | |
| UI | React 19 | Client-side editor and preview |
| Styling | Tailwind CSS v4 via `@tailwindcss/turbopack` | Wired like Family Tree / EnglishEasy (no PostCSS config) |
| UI components | **None** — native `<dialog>`, `<details>`, `<select>`, our small `src/components/ui/` kit | D7: fewer dependencies, same as the sibling apps |
| Icons | Inline SVG components | D7 |
| Form state | **Pure reducer** (`src/biodata/edits.ts`) + React state | D6: no React Hook Form; edits are unit-tested pure functions |
| Validation | Zod 4 | Profiles, database reads and imported backups |
| Browser DB | Dexie.js over IndexedDB | `fake-indexeddb` in unit tests |
| Preferences | localStorage | Theme, app language only |
| Photo processing | Canvas API and Blob | Own cropper (D12) |
| PDF | `harfbuzzjs` + `pdf-lib`, lazy-loaded on first download, fed by the laid-out pages (D49) | Print via `window.print()` as a secondary action |
| Fonts | Noto Sans static TTFs (OFL), self-hosted | D10 |
| PWA | Hand-written `public/sw.js` + `manifest.ts` | D5: the EnglishEasy pattern; no Serwist |
| Tests | Vitest (+ Testing Library, jsdom) and Playwright (installed Chrome locally) | |
| Hosting | Vercel Hobby serving the static `out/` folder; headers in `vercel.json` | D4; portable to Cloudflare Pages unchanged |
| CI | GitHub Actions: lint, typecheck, unit, build, e2e | |

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
- Avoid session replay, external font CDNs and remote image services. **Analytics (D22):** Google Tag Manager runs only on the public marketing pages (`/`, `/templates`, `/help`, `/privacy`), only in Production, and **never** in `/editor`, where personal details are typed. Links from public pages into the editor are full page loads, so GTM can't carry over through client-side navigation. The privacy page states this plainly.
- Prefer self-hosted fonts and assets.
- Set a restrictive Content Security Policy compatible with the static app, and standard security headers at the hosting layer where available. Concretely (D15): `default-src 'self'; connect-src 'self'; img-src 'self' blob: data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'` (a static export inlines Next's bootstrap scripts, so nonces aren't possible). `connect-src 'self'` means even a bug cannot send data to another site.
- **The privacy promise is tested:** an e2e test runs a full session (create, type fixture values, add a photo, download, back up) while recording every request, and fails on any third-party origin or any request carrying a fixture value.
- Use safe text rendering; never render user-entered content as raw HTML.
- Sanitize filenames and validate imported data.
- Do not store secrets in the client bundle.
- No external AI service is called from the application.
- Add clear privacy/help explanations in plain language.
- Follow accessible labels, keyboard navigation, visible focus, sufficient contrast, semantic headings and touch-friendly controls. Target: WCAG 2.2 AA, touch targets ≥ 44 px (D16).
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

Baseline (D20): current Chrome/Edge/Firefox, Safari and iOS Safari 16.4+, Android Chrome. Required APIs: IndexedDB, Blob, canvas, `Intl.Segmenter`, WebAssembly. Playwright's WebKit download is blocked on the owner's machine, so Safari/iOS checks are done by the owner on a real iPhone/Mac at the end of each phase that changes the editor, preview or PDF.

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

The phases below are the product-level order. [BUILD_PLAN.md](BUILD_PLAN.md) breaks each one into session-sized steps with exact “Done when” checks, and holds the Progress table. Release priority (from the original planning conversation): **P0** — dynamic form, autosave/restore, live A4 preview, eight templates, watermark-free PDF, photo, backup/restore; **P1** — all ten languages, PWA/offline, custom sections and advanced layouts; **P2 (after launch, §26)** — optional AI writing help, DOCX. (Image export moved into the launch scope, D38.) All P0 and P1 items are in the phases below and must pass before the public launch.

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

Adapt this to the actual scaffold, but preserve separation of concerns. **The layout actually used is BUILD_PLAN.md §A2**, which follows the sibling apps' convention (pure logic in its own folder with tests beside the code, `e2e/` at the root).

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

Decided 2026-11-20 (D22, D24, D25), following the sibling apps:

- **Google Tag Manager on public pages only**, in Production only (`GTM_ID` set in Vercel's Production environment, read at build time, validated as `GTM-…`). The editor never loads it, and its CSP (`connect-src 'self'`) would block it anyway. Public pages get a CSP that additionally allows Google Tag Manager/Analytics origins.
- **Usage numbers come from Google Analytics reports** (visits, landing-page clicks such as “Create my biodata”). There is **no `/admin` page and no backend**; the app never records drafts, downloads, templates or any form value.
- **Support:** a “Buy me a coffee” link (the siblings' `SUPPORT_URL`) in the footer and on the help page. It is never a gate, a nag or a condition for downloading.
- No ad networks, no paywalls. The project stays free through near-zero operating cost.

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

**What weddingbiodata.in does, from a saved copy of its page (2026-11-20), and where this app differs:** its “free” version strikes through some fields unless the user pays (₹0–20); paid downloads keep the biodata on its server for up to 24 hours; it prints its domain at the foot of every biodata; it pre-adds a Complexion select. This app has no paid tier, no server copy, nothing printed but the user's content, and no default complexion field. Worth learning from it (functionally): text size Auto/XS–XL and ALL CAPS labels (D31), document-language option text (D33), starter field sets (D32), quoted About me / Partner preferences paragraphs, optional title and blessing at the top, label + value custom fields with “Add more fields”, the notice “a document tool only; it does not match or connect people”, and its SEO structure (D36).

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

---

## 24. Decision log

Later rows override the sections they name. Add a row whenever a product or architecture decision is made; never rewrite an old row (add a new one that supersedes it).

| # | Date | Decision | Why | Overrides |
|---|---|---|---|---|
| D1 | 2026-11-20 | One HTML/CSS document laid out into A4 page boxes is the preview, the print output and the PDF source. The Download engine is chosen by the Phase 0 spike (candidates A–D in §11). **Status: decided by the spike, see D49.** | “See exactly what you download”; the browser already shapes Indic scripts correctly; one layout to maintain | §11 candidate `@react-pdf/renderer`, §12 PDF row |
| D2 | 2026-11-20 | Browser print is a secondary **Print** action, never labelled as a download | §11 honesty rule | — |
| D3 | 2026-11-20 | **Share PDF** button where `navigator.canShare({ files })` is true (Android Chrome, iOS Safari) | The main use case is sending the biodata on WhatsApp; this skips the downloads folder | §1, §4 |
| D4 | 2026-11-20 | Next.js `output: 'export'`; Vercel Hobby serves `out/`; security headers in `vercel.json`. Draft identity is a query parameter: `/editor?d=<id>` (not `/editor/[profileId]`) | A static export can't contain server code, so the no-backend rule is enforced by the build. Dynamic routes for ids that exist only in the browser are unsupported in static export | §5 routes suggested in the planning conversation, §12 Hosting row |
| D5 | 2026-11-20 | Hand-written service worker (EnglishEasy pattern), no Serwist / next-pwa | Narrow, versioned caching we fully understand; no plugin coupling to Next's build | §12 PWA row |
| D6 | 2026-11-20 | No React Hook Form; profile edits are pure reducer functions, autosave watches the profile; validation is advisory and never blocks | The data is a dynamic nested document saved on every change; pure functions are easier to test than a form library synced to IndexedDB | §12 Form state row |
| D7 | 2026-11-20 | No shadcn/ui, Radix, Lucide or drag-and-drop library; native elements, inline SVG icons, Move up/down reordering | Small dependency tree (as in the sibling apps); up/down buttons are accessible and work on phones | §12 UI components and Icons rows, §6 reorder |
| D8 | 2026-11-20 | Backup = one versioned JSON file with base64 photos | Photos are small after resizing; no ZIP dependency; simple to validate | §9 ZIP preference |
| D9 | 2026-11-20 | Profile + photo saved in one transaction; per-profile `revision`; stale tabs stop autosaving and ask to reload | Prevents silent overwrites between two tabs and dangling photo references | — (addition to §9) |
| D10 | 2026-11-20 | Noto Sans static TTFs (OFL), Regular + Bold per script, same files for preview and PDF, self-hosted; Latin display face for traditional templates chosen in Phase 4 | One font file per script = identical shaping in preview and PDF; offline; licence allows bundling | §8 font requirements (refines) |
| D11 | 2026-11-20 | Separate **document language** (all ten at launch) and **app language** (English + Telugu first, others after review); review status per dictionary | ~150 printed labels can be reviewed carefully; translating the whole UI into ten languages without native review risks embarrassing errors | §8 (scope sequencing) — pending §25 Q2 |
| D12 | 2026-11-20 | Store downscaled source + normalised crop; one photo frame aspect for all templates (4:5, superseded by D30); own cropper | Lossless re-cropping; one aspect keeps templates interchangeable | §10 |
| D13 | 2026-11-20 | Age computed from DOB at render time (opt-in); height stored in cm, picked in ft/in | Stored ages go stale; one unit avoids parsing free text | §6 |
| D14 | 2026-11-20 | Dates DD-MM-YYYY by default; 12-hour birth time | Indian convention | §6 |
| D15 | 2026-11-20 | CSP with `connect-src 'self'`; e2e test proves no outbound personal data | Makes the privacy promise enforceable and tested | §13 (refines) |
| D16 | 2026-11-20 | WCAG 2.2 AA, 44 px touch targets | Elders on phones are core users | §13 (refines) |
| D17 | 2026-11-20 | Product name in one constant (`src/lib/site.ts`); working title “Vivah Bio” (superseded by D37) | Name is provisional | — |
| D18 | 2026-11-20 | Code MIT, fonts OFL 1.1 | Same as sibling apps; fonts' licence | — |
| D19 | 2026-11-20 | Image (PNG/JPEG) export moves after launch (superseded by D38) | Optional in §1; PDF + Share covers WhatsApp | §1 item 7 |
| D20 | 2026-11-20 | Browser baseline and owner-run Safari/iOS checks (§14) | WebKit can't be installed for Playwright here | §14 (refines) |
| D21 | 2026-11-20 | Opt-in motif library of original artwork + editable invocation line; “None” first; A4 portrait only in MVP | Respect for every tradition; no inference from fields | §7 (refines) |
| D22 | 2026-11-20 | **Owner's choice:** Google Tag Manager on public pages only (`/`, `/templates`, `/help`, `/privacy`), Production only, never in `/editor`; links into the editor are full page loads; per-path CSP in `vercel.json` (public pages allow GTM/GA origins, the editor stays `connect-src 'self'`); an e2e test proves the editor never requests a third-party origin | Same pattern as the sibling apps; personal data is only ever typed in the editor | §13 “avoid third-party analytics”, §19 |
| D23 | 2026-11-20 | **Owner's choice:** editor UI in **English only** at launch; document labels in all ten languages; app strings still in a dictionary | Smallest translation surface to review; the printed document is what families share | D11 (app-language part), §8, §25 Q2 |
| D24 | 2026-11-20 | **Owner's choice:** usage numbers from Google Analytics reports; no `/admin` page, no counting backend | A sibling-style `/admin` needs a database; the static, backend-free app is kept | §19 |
| D25 | 2026-11-20 | **Owner's choice:** “Buy me a coffee” link (footer, help page), never a gate | As in the sibling apps | §19 |
| D26 | 2026-11-20 | **Owner's choice:** a professional, search-engine-ready landing page like the siblings': `content.ts` with `TITLE`, `DESCRIPTION` (≤ 160 characters, unit-tested), FAQ rendered on the page **and** as `FAQPage` structured data (one source), `WebApplication` structured data (price 0), canonical URLs, Open Graph, `robots.ts`/`sitemap.ts` that allow indexing in Production only, Google Search Console verification tag, real product screenshots as WebP pictures (`next/image` unoptimized) | Discoverability is the only marketing a free app gets | §5 landing, §16 Phase 6 (refines) |
| D27 | 2026-11-20 | **Owner's choice:** pictures and docs like the siblings': `npm run images` (sharp) builds favicon, apple icon, the link preview `opengraph-image.png` (1200 × 630, < 300 KB for WhatsApp), GitHub's `docs/social-preview.png` (1280 × 640, content 80 px in from the edges) and the landing WebPs from `docs/screenshots/`; README with screenshots; `docs/PROJECT_GUIDE.md`, a beginner's guide to the code kept true as files change | Professional first impression on GitHub, WhatsApp and search results | §16 Phase 6 (refines) |
| D28 | 2026-11-20 | Family section = one list of family members `{ relation, details }`, relation printed as the label; fields can move between sections; maternal Gotra and Nakshatra pada are default fields; “15-March-1998” date style | Learned from the owner's real biodata, where family rows are free relations with details and Education/Profession sit under Personal details | §6 (siblings, sections, dates) |
| D29 | 2026-11-20 | The owner's own biodata (`docs/references/`, **git-ignored, never committed**: it holds real names, phone numbers, address and photo) is the model for Classic Gold and for **milestone M1**: the owner makes that same biodata with the app. Its real values never go into code, fixtures, screenshots or commits; tests use a fictional profile with the same shape | The first real user is the owner; the repo is public | §7 Classic Gold, §16 order |
| D30 | 2026-11-20 | Photo frames are **3:4** portrait | The reference photo is a tall portrait; 4:5 would crop it | D12 aspect |
| D31 | 2026-11-20 | Text size Auto (largest that fits one page, never below 9 pt body) or XS–XL; labels Normal or ALL CAPS | Families strongly prefer a one-page biodata; seen on the reference site | §11 “do not squeeze” (refines with a floor) |
| D32 | 2026-11-20 | Optional starter field sets (General default; Hindu, Muslim, Christian, Sikh, Jain) chosen explicitly when creating a draft | Each tradition expects different fields; an explicit choice respects “never infer” | §6 (addition) |
| D33 | 2026-11-20 | List-picked values stored as option keys and printed in the document language; typed values printed as typed | Telugu labels with English “Never married” would look broken | §8 (refines) |
| D34 | 2026-11-20 | Eight templates on three layout skeletons (Classic, Modern, Minimal) with distinct artwork, palettes and type | Consistency and low maintenance; competitors' many designs are one skeleton reskinned | §7 (refines) |
| D35 | 2026-11-20 | Nothing printed except the user's content: no site name/URL/watermark; nothing struck through or gated; footer notice that the app doesn't match or connect people | The main difference from the reference sites | §2, §7 (refines) |
| D36 | 2026-11-20 | SEO structure modelled on the leading competitor: `hreflang` alternates and `og:locale` alternates for ten static language landing pages (`/te`, `/hi`, …, each in that language), five tradition pages (Hindu, Muslim, Christian, Sikh, Jain biodata format), a template gallery of real sample images, a “what to write in each part” guide; structured data `Organization`, `WebSite`, `WebApplication` (`isAccessibleForFree`, price 0), `BreadcrumbList`, `FAQPage`, image `ItemList`. No `HowTo` (Google stopped showing it), no fake counters (“biodatas created today”) since nothing is counted | Search is the only marketing; honest numbers only | D26 (extends), §25 Q4 |
| D37 | 2026-11-20 | **Owner's choice:** name **Free Wedding Biodata**; URL `free-wedding-biodata.vercel.app`; SEO title “Free Wedding Biodata Maker – Create & Download Biodata PDF” (58 characters); homepage H1 “Free Wedding Biodata Maker”; the short description is shown on the page in full (174 characters) and trimmed to 148 characters for the meta description, which the D26 test keeps ≤ 160 | The name says what it does and matches the repository and the address; Google truncates descriptions near 160 characters | D17, §25 Q1, the working title in the header |
| D38 | 2026-11-20 | **Owner's choice:** image export (PNG/JPEG per page, Save and Share) is in the launch scope, built with the PDF in Step 4.1 from the same display list | Families share biodatas as WhatsApp statuses and chat images, not only as PDFs | D19, §1 item 7, §26 |
| D39 | 2026-11-20 | Template design vocabulary (top element, frame family incl. thoranam, paper tint, background watermark, heading-bar style, photo frame), About me first in the default order, three colour variants per template | Learned from the competitor's ten showcase designs (functional reference only, git-ignored); gives variety from eight maintainable templates | §7 (refines), §6 default order |
| D40 | 2026-11-21 | **Owner's choice — photos:** the main photo frame is portrait **3:4 or tall 2:3** (the user picks; tall suits full-length photos), an optional **second photo** on page 1, and up to **4 extra photos on photo pages** (1, 2 or 4 per page) drawn inside the same template frame and top element. Photos are stored as downscaled sources up to 3000 px on the long edge (JPEG ≈ 0.9) so a full-page photo prints at about 300 dpi and zooming stays sharp; the PDF embeds each photo once at the resolution its frame needs | 10 of 32 real biodatas use tall full-length photos; 7 of 15 PDFs add photo pages (often on plain white); none repeat a photo on every page | D30 (aspect), D12 (≤ 1600 px) |
| D41 | 2026-11-21 | **Owner's choice — horoscope chart:** at launch, attach a photo or scan of the horoscope as its own framed page (same pipeline as photo pages); a typed South Indian 12-box Rasi/Navamsa grid in the document language comes after launch (§26) | Culturally important for some families, rare in the sample (1/32); the attach route is cheap and reuses D40 | §2 non-goals (clarifies: display only, no calculation) |
| D42 | 2026-11-21 | **Owner's choice — search wording:** title “Free Wedding Biodata Maker – Marriage Biodata PDF & PNG” (55 characters); meta description “Create a free marriage biodata online in minutes. Pick a beautiful design, add your photo and details, and download a high-quality PDF or PNG. No login needed.” (159); the on-page short description adds “or PNG”. H1 unchanged | “Marriage biodata” is the phrase families search; PNG is now a launch feature (D38) | D37 title and descriptions |
| D43 | 2026-11-21 | **Owner's choice — first steps:** no wizard. “Create my biodata” opens the editor; its first card is **Top of your biodata** (blessing icon, invocation line or title, “None” first, drawn in the template colour), then a one-line language notice (“Labels print in English. Anything you type stays exactly as typed.”), then the sections. Tradition-specific fields are offered as one-tap chips inside Horoscope / Religion (“Add Hindu fields”, “Add Muslim fields”…) instead of an up-front choice | Simplest path for a new user; still never infers from the Religion value | D32 (when the starter set is offered) |
| D44 | 2026-11-21 | **From the 32 real biodatas:** preset, correctly spelt labels with fixed alignment in every template; Partner preferences can print as rows, a bulleted list or a paragraph; a **References** section (repeating person, relation/business, place, phone) in the “Add a section” quick picks, and a relation note on every contact; wider relation suggestions (Brother-in-law, Sister-in-law, Paternal/Maternal uncle, “(Late)” prefix); a **large-name letterhead** header option in every skeleton; a dark festive colour variant (maroon or purple paper with gold text); a **9:16 phone-story** size in image export; character counters with example placeholders for About me (600) and Partner preferences (500); always a real text layer in the PDF (8 of 15 sample PDFs were image-only) | Each prevents a problem or matches a pattern seen repeatedly in real biodatas (misaligned colons ~8, label typos ~9, letterheads 9, references 5, multi-contact ~10, list-style preferences 7/8) | §6, §7, D38 (extends) |
| D45 | 2026-11-21 | **From the competitor teardown (our own implementation):** motifs coloured from template tokens (ink gradient plus a pale base), so one drawing serves every colour variant; title styles “BIODATA” (spaced serif), script “Biodata” and the localized title, each between thin flourishes; on phones a floating **Preview** pill (hidden while the keyboard is up) opens a **bottom sheet** (≈ 92 % height; close by swipe, ✕, backdrop or Esc) holding the live preview, design and colour chips, text size, and Download PDF / Share / Save image, so phone users finish without leaving the editor; text-size hints with page counts (“Fits on one page”, “Takes 2 pages”); row-safe page breaks with headings kept with their first row; photo empty-state tips; per-row ⌃ ⌄ and a delete confirmation naming the field | Strongest parts of the reference flow, fixing its weak spots (stale snapshot preview, no download in the sheet, religion-driven field swaps, analytics with personal data) | §5 phone layout, §7, D31 (extends) |
| D46 | 2026-11-21 | **Owner's request — more designs:** launch with **20 designs × 3 colour variants (60 looks)**, still on the three layout skeletons (D34) and built from about 14 original frame families (foliage, marigold thoranam, temple bells and diyas, rangoli band, paisley, baroque filigree, gold filigree on dark paper, watercolour roses, watercolour leaves, green vines, filigree with bow, brush-stroke washes, rosette border, peacock, mandala corners, marigold strings) plus top element, paper tint, heading-bar style and watermark. Designs: Classic Gold, Kalyanam, Temple Bells, Rangoli, Paisley, Royal Maroon, Deepam (dark paper, gold), Baroque Gold, Sandalwood (letterhead), Peacock, Floral Ivory, Watercolour Rose, Mango Grove (watercolour leaves), Mint Vines, Peach Filigree, Executive Navy, Modern Two-Column, Slate Brush, Navy Rosette, Minimal Ivory. A design is data (skeleton + frame + defaults + palettes), so more can be added after launch without new layout code | The leading competitor offers 40; real biodatas show dark festive papers, thoranams, temple frames and watercolour florals. Shared skeletons keep 20 designs maintainable | §7 initial collection, D34 (count), D39 (24 looks) |
| D47 | 2026-11-21 | **Owner's OK — pre-build suggestions:** (1) warn when a photo has too few pixels for its frame at print size (below ~200 dpi), with a hint to use a sharper photo; (2) capitalise the first letter of typed labels and values automatically (the rest is left as typed; can be undone per field); (3) before launch, the Khanda and Jain motifs and every document-label translation are reviewed by people from those communities/languages (owner-arranged; tracked as owner checks); (4) motifs that use font glyphs (Om, Ik Onkar, Allah, “॥ श्री गणेशाय नमः ॥”) are converted to vector paths so they look identical on every device and in the PDF | Blurry photos and inconsistent capitalisation were common in the real biodatas; respectful, correct symbols and labels matter more than speed; glyph shapes vary across platforms | §10, §6, D21, D45 |
| D48 | 2026-11-21 | **Owner's choice — app icon:** an ivory biodata page with a folded corner on a maroon tile, carrying two solid gold hearts side by side (the “A·fav” design), used **everywhere**: favicon, app icon, home-screen icon, header logo, link preview and social preview. Source: `docs/brand/app-icon.svg` (committed). Colours: tile `#9b2232`→`#6e1420`, page `#fffaf0`, gold `#f2cd6b`→`#c8962e` | Says “a document about two people joining”, religion-neutral, and stays legible down to a 16 px browser tab | Q6 |
| D49 | 2026-11-21 | **PDF engine (Phase 0 spike, `docs/spikes/PDF_SPIKE.md`):** Download/Share PDF = candidate **C**, a vector writer that reads the browser's laid-out pages (display list) and shapes each line with **HarfBuzz** (`harfbuzzjs`, WebAssembly) using the same Noto TTFs, written with **pdf-lib** (subset Type0 fonts, `/ActualText` for copy/paste), lazy-loaded on the first download; **Save/Share as image** = the same display list drawn on a canvas (candidate D's `drawPage`); **Print** = `window.print()` of the same pages. Rejected: `@react-pdf/renderer` (crashes on Telugu/Malayalam/Gurmukhi, drops Hindi/Marathi characters, garbles Bengali, second layout engine), Chrome print as the download (no one-click download, broken Indic text layer), raster PDF as the download (6 MB, no text) | Only C matched Chrome glyph for glyph in all ten languages *and* gave a one-click, small (177 KB for 11 pages), selectable PDF from one layout; ~650 KB gzip loaded only when downloading | D1 (decides), §11, D38 |

## 25. Open questions for the owner

| # | Question | Default if not answered |
|---|---|---|
| Q1 | ~~Final product name and domain~~ — answered 2026-11-20: Free Wedding Biodata at free-wedding-biodata.vercel.app (D37) | — |
| Q2 | ~~App (UI) languages at launch~~ — answered 2026-11-20: English only (D23) | — |
| Q3 | Who can review the document-label translations for each language before they are marked reviewed? | Ship marked “not yet reviewed” |
| Q4 | Per-language and per-tradition landing pages for search (D36)? The leading competitor has both. | Yes: ten language pages and five tradition pages, static, written once, with real sample pictures |
| Q6 | ~~App icon~~ — answered 2026-11-21: the linked-hearts page, favicon design, everywhere (D48) | — |
| Q5 | Does the privacy page need a cookie notice for Google Analytics on public pages (India's DPDP Act)? The siblings have none. | Plain-language disclosure on the privacy page, no banner |

## 26. After launch (not in the MVP)

- Landscape and other page sizes.
- DOCX export.
- Optional, user-controlled AI writing help (About me, partner expectations). It must stay optional, off by default, and never required for any essential flow; it would need a separate privacy decision because text would leave the device.
- More templates, motif artwork and font presets.
- Typed South Indian Rasi/Navamsa 12-box chart (D41).
- Optional cover page (4 of 32 real biodatas had one).
