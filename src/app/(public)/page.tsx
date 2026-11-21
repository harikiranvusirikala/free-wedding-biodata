import { ContinueEditing } from "@/components/landing/ContinueEditing";
import { button } from "@/components/ui/button";
import { card, cardText, cardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { pageWidth } from "@/components/ui/page";
import { t } from "@/lib/i18n";
import { HEADLINE, SHORT_DESCRIPTION } from "@/lib/site";

// What the app is, Create my biodata (always a new draft) with Continue editing under it when this browser has a
// draft (Step 1.4), and the privacy promise. The full landing page (product pictures, templates, FAQ) comes in
// Step 6.1 (BUILD_PLAN A7, landing composition). Links into the editor are plain <a> (VISION D22).

const PROMISES = ["device", "free", "language"] as const;

export default function Home() {
  const [first, ...rest] = HEADLINE.split(" ");
  const highlighted = rest.slice(0, 2).join(" ");
  const tail = rest.slice(2).join(" ");
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[560px] bg-[radial-gradient(55%_60%_at_50%_30%,rgb(222_160_70/0.22),transparent),radial-gradient(50%_50%_at_75%_20%,rgb(138_28_43/0.10),transparent)] dark:opacity-40"
      />
      <div className={`${pageWidth} relative py-16 sm:py-24 lg:py-28`}>
        <div className="flex flex-col items-center text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden />
            {t("home.badge")}
          </p>
          <h1 className="mt-6 max-w-4xl text-[34px] leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {first}{" "}
            <span className="bg-[linear-gradient(100deg,#8a1c2b,#be123c_45%,#ea580c)] bg-clip-text text-transparent dark:bg-[linear-gradient(100deg,#f5c66b,#fb7185,#fda4af)]">
              {highlighted}
            </span>{" "}
            {tail}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-pretty text-ink-2">{SHORT_DESCRIPTION}</p>
          <div className="mt-8 flex w-full flex-col items-center gap-2">
            <a href="/editor?new=1" className={`${button("primary", "lg")} h-12 px-6 text-base`}>
              <Icon name="edit" className="size-[18px]" />
              {t("header.create")}
            </a>
            <ContinueEditing />
          </div>
        </div>

        <ul className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          {PROMISES.map((id) => (
            <li key={id} className={`${card} p-5`}>
              <h2 className={cardTitle}>{t(`home.promise.${id}.title`)}</h2>
              <p className={`mt-1.5 ${cardText}`}>{t(`home.promise.${id}.text`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
