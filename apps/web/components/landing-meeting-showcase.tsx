import { useLocale, useTranslations } from "next-intl";
import { ProductScreenshot } from "@/components/product-screenshot";

export function LandingMeetingShowcase() {
  const t = useTranslations("landing.screenshot");
  const locale = useLocale();
  return <ProductScreenshot src={`/landing/product-call-${locale}.webp`} alt={t("callAlt")} label={t("callLabel")} caption={t("callCaption")} inspect={t("inspect")} priority />;
}
