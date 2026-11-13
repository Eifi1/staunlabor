import { useTranslation } from "react-i18next";
import { Card, PageHeader, TextLink, usePageSeo } from "@eifi1/ui-kit";
import { PAGE_SHELL } from "@/shared/ui/page-shell";
import { ISSUES_URL, SOURCE_URL } from "./operator";

/** What Staunlabor is, where its exhibits come from, and that it is free and
 *  open: the museum named as the model, in words only. */
export function AboutPage() {
  const { t } = useTranslation();
  usePageSeo({ canonicalPath: "/about", title: t("site.about.title"), description: t("site.about.lead") });
  const paragraphs = ["what", "computed", "model", "open"] as const;
  return (
    <div className={PAGE_SHELL}>
      <PageHeader size="sm" title={t("site.about.title")} description={t("site.about.lead")} />
      <Card padding="md" density="compact" className="space-y-3 text-sm text-secondary">
        {paragraphs.map((key) => (
          <p key={key}>{t(`site.about.${key}`)}</p>
        ))}
        <p>
          {t("site.about.feedback")} <TextLink href={ISSUES_URL}>{t("site.about.issues")}</TextLink> ·{" "}
          <TextLink href={SOURCE_URL}>{t("site.about.source")}</TextLink>
        </p>
      </Card>
    </div>
  );
}
