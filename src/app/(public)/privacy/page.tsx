import type { Metadata } from "next";
import { AsideCard, ContentPage, ContentSection, Prose } from "@/components/ContentPage";
import { ExternalLink } from "@/components/ExternalLink";
import { Rich } from "@/components/Rich";
import { button } from "@/components/ui/button";
import { card, cardBody, cardText, cardTitle, iconTile, noteCard } from "@/components/ui/card";
import { GitHubMark, Icon, type IconName } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { REPOSITORY_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: t("privacy.metaTitle"),
  description: t("privacy.metaDescription"),
  alternates: { canonical: "/privacy" },
};

// The local-storage explanation (VISION §9, mockup: privacy) as a content page (BUILD_PLAN A7). It says only
// what is true today: backups and the delete buttons are described as coming, not offered (Part B rule 4).

const SECTIONS = [
  { id: "overview", label: t("privacy.nav.overview") },
  { id: "where", label: t("privacy.where.title") },
  { id: "sent", label: t("privacy.sent.title") },
  { id: "keep", label: t("privacy.keep.title") },
  { id: "remove", label: t("privacy.remove.title") },
];

const PROMISES: { id: "device" | "made" | "signup"; icon: IconName }[] = [
  { id: "device", icon: "phone" },
  { id: "made", icon: "file" },
  { id: "signup", icon: "lock" },
];

const GLANCE = ["privacy.glance.1", "privacy.glance.2", "privacy.glance.3", "privacy.glance.4"] as const;

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow={t("privacy.eyebrow")}
      title={t("privacy.title")}
      lead={t("privacy.lead", { name: SITE_NAME })}
      sections={SECTIONS}
      aside={
        <>
          <div className={`${card} p-[18px]`}>
            <h2 className={`${cardTitle} text-[15px]`}>{t("privacy.glance.title")}</h2>
            <ul className="mt-3 grid gap-2.5 text-sm text-ink-2 sm:grid-cols-2 xl:grid-cols-1">
              {GLANCE.map((key) => (
                <li key={key} className="flex items-start gap-2.5">
                  <Icon name="check" className="mt-0.5 size-4 text-good" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
          <AsideCard title={t("privacy.code.title")} text={t("privacy.code.text")}>
            <ExternalLink href={REPOSITORY_URL} className={button("secondary")}>
              <GitHubMark className="size-4" />
              {t("privacy.code.action")}
            </ExternalLink>
          </AsideCard>
          <AsideCard title={t("privacy.help.title")} text={t("privacy.help.text")}>
            <a href="/help" className={button("secondary")}>
              <Icon name="help" className="size-4" />
              {t("privacy.help.action")}
            </a>
          </AsideCard>
        </>
      }
    >
      <ul className="grid gap-3.5 sm:grid-cols-3">
        {PROMISES.map(({ id, icon }) => (
          <li key={id} className={`${card} ${cardBody} flex gap-3.5 sm:block`}>
            <span className={`${iconTile} bg-good-soft text-good`}>
              <Icon name={icon} className="size-[18px]" />
            </span>
            <div className="min-w-0 sm:mt-3">
              <p className={`${cardTitle} text-[15px]`}>{t(`privacy.promise.${id}.title`)}</p>
              <p className={`mt-1 ${cardText}`}>{t(`privacy.promise.${id}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>

      <ContentSection id="where" title={t("privacy.where.title")}>
        <Prose>
          <p>{t("privacy.where.1")}</p>
          <p>{t("privacy.where.2")}</p>
        </Prose>
      </ContentSection>

      <ContentSection id="sent" title={t("privacy.sent.title")}>
        <Prose>
          <p>
            <Rich text={t("privacy.sent.1")} />
          </p>
          <p>{t("privacy.sent.2")}</p>
          <p>
            <Rich text={t("privacy.sent.3")} />
          </p>
        </Prose>
      </ContentSection>

      <ContentSection id="keep" title={t("privacy.keep.title")}>
        <Prose>
          <p className={noteCard}>
            <Rich text={t("privacy.keep.note")} />
          </p>
          <p>{t("privacy.keep.2")}</p>
        </Prose>
      </ContentSection>

      <ContentSection id="remove" title={t("privacy.remove.title")}>
        <Prose>
          <p>{t("privacy.remove.1")}</p>
          <p>{t("privacy.remove.2")}</p>
        </Prose>
      </ContentSection>
    </ContentPage>
  );
}
