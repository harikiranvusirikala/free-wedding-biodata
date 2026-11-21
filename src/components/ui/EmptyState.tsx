import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/**
 * A friendly "nothing here yet", or a screen that says one thing (page not found, something went wrong):
 * an icon in a soft tile, a heading, a sentence or two and the actions, centred.
 */
export function EmptyState(props: {
  icon: IconName;
  tone?: "brand" | "danger";
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  const { icon, tone = "brand", eyebrow, title, children, actions, as: Heading = "h2", className = "" } = props;
  const tile = tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-ink";
  return (
    <div className={`flex flex-col items-center px-2 text-center ${className}`}>
      <span className={`flex size-12 items-center justify-center rounded-2xl ${tile}`}>
        <Icon name={icon} className="size-6" />
      </span>
      {eyebrow && <p className="mt-5 text-xs font-bold tracking-[0.12em] text-brand-ink uppercase">{eyebrow}</p>}
      <Heading className={`${eyebrow ? "mt-2" : "mt-5"} text-2xl leading-tight font-bold tracking-tight text-balance text-ink sm:text-[28px]`}>{title}</Heading>
      {children && <div className="mt-3 max-w-md text-[15px] leading-relaxed text-pretty text-ink-2">{children}</div>}
      {actions && <div className="mt-7 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">{actions}</div>}
    </div>
  );
}
