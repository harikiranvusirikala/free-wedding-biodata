import { HEADLINE, SHORT_DESCRIPTION } from "@/lib/site";

// Step 0.1: what the app is and the privacy promise. The full landing page (buttons, product pictures,
// templates, FAQ) comes in Step 6.1 (BUILD_PLAN A7, landing composition).

const PROMISES = [
  {
    title: "Stays on your device",
    text: "Your details and photo are saved only in this browser. Nothing is uploaded, and there is no account to create.",
  },
  {
    title: "Free, with no watermark",
    text: "Every design, every download. No payment, no sign-up and no ads.",
  },
  {
    title: "Your language, your format",
    text: "Headings in English, Telugu, Hindi and seven more Indian languages, on an A4 page ready to print or share.",
  },
];

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
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="flex flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card">
          <span className="size-1.5 rounded-full bg-gold" aria-hidden />
          Free · No login · Private
        </p>
        <h1 className="mt-6 max-w-4xl text-[34px] leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {first}{" "}
          <span className="bg-[linear-gradient(100deg,#8a1c2b,#be123c_45%,#ea580c)] bg-clip-text text-transparent dark:bg-[linear-gradient(100deg,#f5c66b,#fb7185,#fda4af)]">
            {highlighted}
          </span>{" "}
          {tail}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-pretty text-ink-2">{SHORT_DESCRIPTION}</p>
        </div>

        <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <h2 className="text-base font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-1.5 text-sm text-pretty text-ink-3">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
