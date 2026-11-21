import { MessageScreen } from "@/components/MessageScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <MessageScreen>
      <EmptyState
        as="h1"
        icon="file"
        eyebrow={t("notFound.eyebrow")}
        title={t("notFound.title")}
        actions={
          <a href="/" className={button("primary")}>
            <Icon name="home" className="size-4" />
            {t("notFound.home")}
          </a>
        }
      >
        {t("notFound.text")}
      </EmptyState>
    </MessageScreen>
  );
}
