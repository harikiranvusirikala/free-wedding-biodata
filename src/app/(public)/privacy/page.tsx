import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Your biodata stays in your browser: how Free Wedding Biodata stores your details and photo, and how to remove them.",
  alternates: { canonical: "/privacy" },
};

// The local-storage explanation (VISION §9). A content page in three columns (BUILD_PLAN A7): section nav,
// text, an "at a glance" card; one column below lg.

const SECTIONS = [
  {
    id: "where",
    title: "Where your biodata is kept",
    body: [
      "Everything you type and the photo you add are saved in this browser's own storage (IndexedDB) on this device. They are not sent to any server: the site is a set of plain files, with no database and no accounts.",
      "Because there is no account, your drafts don't follow you to another phone or computer. To move a draft, download a backup file and open it on the other device.",
    ],
  },
  {
    id: "sent",
    title: "What leaves your device",
    body: [
      "Nothing you enter. The editor is locked by a security policy that lets it talk only to this website, so even a mistake in the code couldn't send your details anywhere else.",
      "Your biodata leaves your device only when you choose to: when you download the PDF or image, print it or share it.",
      "This site has no analytics yet. If visit counting is added, it will be on the public pages only (this page, the home page, help), never in the editor.",
    ],
  },
  {
    id: "keep",
    title: "Keeping it safe",
    body: [
      "Browsers can clear site storage: when you clear browsing data, use a private window, or the device runs low on space. Download a backup whenever you finish an important change.",
      "Anyone who uses this browser profile can open your drafts. On a shared computer, delete them when you're done.",
    ],
  },
  {
    id: "remove",
    title: "Removing your data",
    body: [
      "You can delete a single draft, or all your local data at once, from the editor. Clearing this site's data in your browser settings removes everything too. Nothing is kept anywhere else.",
    ],
  },
];

const GLANCE = ["No account or login", "Saved only in this browser", "Nothing uploaded", "No ads"];

export default function PrivacyPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-10 lg:px-8 xl:grid-cols-[11rem_minmax(0,1fr)_16rem]">
      <nav aria-label="On this page" className="hidden lg:row-span-2 lg:block">
        <p className="mb-3 px-3 text-xs font-semibold tracking-[0.08em] text-ink-3 uppercase">On this page</p>
        <ul className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-ink-3 hover:bg-sunken hover:text-ink">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="max-w-2xl">
        <header>
          <p className="text-xs font-bold tracking-[0.12em] text-brand-ink uppercase">Privacy</p>
          <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">Your biodata stays with you</h1>
          <p className="mt-3 text-ink-2">
            A biodata holds personal details about you and your family. This page explains where they are kept and who can see them.
          </p>
        </header>

        <article className="mt-10 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-pretty text-ink-2">
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>

      <aside className="max-w-2xl lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:max-w-none">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card xl:sticky xl:top-24">
          <h2 className="text-base font-semibold tracking-tight">At a glance</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
            {GLANCE.map((g) => (
              <li key={g} className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="size-4 flex-none text-good" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
